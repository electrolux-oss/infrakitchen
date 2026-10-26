import { useCallback, useEffect, useMemo, useState } from "react";

import { Label } from "../../common/components/labels";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { UPDATE_RESOURCE_MUTATION } from "../../resources/graphql";
import { VariableInput } from "../../resources/types";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "../../ui";
import { ENTITY_STATE } from "../../utils/constants";
import { buildSchemaQuery, runInBatches, sameValue } from "../utils";

import { VariableCellInput, VariableCellInputProps } from "./VariableCellInput";

interface FetchedResource {
  id: string;
  name: string;
  state: string;
  variables: VariableInput[] | null;
  tempState: { value: Record<string, any> | null } | null;
  sourceCodeVersion: { id: string } | null;
  project: { id: string } | null;
  parents: { id: string }[] | null;
}

/** Template schema facts the cells depend on, per variable name. */
type VariableSchemaInfo = { options: string[]; frozen: boolean };
type SchemaByResource = Record<string, Record<string, VariableSchemaInfo>>;

interface BatchResource {
  id: string;
  name: string;
  state: string;
  sourceCodeVersionId: string | null;
  projectId: string | null;
  parentIds: string[];
  /** Variables as they will be once pending changes are applied. */
  variables: VariableInput[];
  /** Currently applied value of each variable that has a pending change. */
  pendingBaseline: Record<string, unknown>;
  hasPendingChanges: boolean;
}

/**
 * A resource edited while provisioned keeps its changes in the temporary
 * state until they are applied: `tempState.value.variables` then holds the
 * full variable list that will take effect, so that list is what gets edited.
 */
const toBatchResource = (resource: FetchedResource): BatchResource => {
  const applied = resource.variables ?? [];
  const pendingValue = resource.tempState?.value ?? null;
  const pending = Array.isArray(pendingValue?.variables)
    ? (pendingValue.variables as VariableInput[])
    : null;

  const pendingBaseline: Record<string, unknown> = {};
  if (pending) {
    const appliedByName = new Map(applied.map((v) => [v.name, v]));
    pending.forEach((variable) => {
      const before = appliedByName.get(variable.name);
      if (
        !before ||
        JSON.stringify(before.value) !== JSON.stringify(variable.value)
      ) {
        pendingBaseline[variable.name] = before?.value;
      }
    });
  }

  // Pending variables follow the pending version's schema, if there is one.
  const hasPendingVersion =
    !!pendingValue &&
    Object.prototype.hasOwnProperty.call(
      pendingValue,
      "source_code_version_id",
    );

  return {
    id: resource.id,
    name: resource.name,
    state: String(resource.state ?? "").toLowerCase(),
    sourceCodeVersionId: hasPendingVersion
      ? ((pendingValue?.source_code_version_id as string | null) ?? null)
      : (resource.sourceCodeVersion?.id ?? null),
    projectId: resource.project?.id ?? null,
    parentIds: (resource.parents ?? []).map((parent) => parent.id),
    variables: pending ?? applied,
    pendingBaseline,
    hasPendingChanges:
      pendingValue !== null && Object.keys(pendingValue).length > 0,
  };
};

type IkApi = ReturnType<typeof useConfig>["ikApi"];

/**
 * Template schema (options, frozen) of every resource in one aliased query.
 * Resources sharing a template version, parents and project share one field.
 * Without a schema the cells fall back to plain, editable inputs.
 */
const fetchSchemas = async (
  ikApi: IkApi,
  resources: BatchResource[],
): Promise<SchemaByResource> => {
  const groups = new Map<string, BatchResource[]>();
  resources.forEach((resource) => {
    if (!resource.sourceCodeVersionId) return;
    const key = [
      resource.sourceCodeVersionId,
      resource.projectId ?? "",
      [...resource.parentIds].sort().join(","),
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), resource]);
  });
  if (groups.size === 0) return {};

  const entries = [...groups.values()];
  const { query, variables } = buildSchemaQuery(
    "BatchVariableSchemas",
    entries.map(([first]) => ({
      sourceCodeVersionId: first.sourceCodeVersionId as string,
      parentIds: first.parentIds,
      projectId: first.projectId,
    })),
    "name options frozen",
  );

  try {
    const response = await ikApi.graphqlRequest<
      Record<string, { name: string; options: string[]; frozen: boolean }[]>
    >(query, variables);
    const result: SchemaByResource = {};
    entries.forEach((group, i) => {
      const byName = Object.fromEntries(
        (response[`s${i}`] ?? []).map((variable) => [
          variable.name,
          { options: variable.options ?? [], frozen: !!variable.frozen },
        ]),
      );
      group.forEach((resource) => {
        result[resource.id] = byName;
      });
    });
    return result;
  } catch (error) {
    notifyError(error);
    return {};
  }
};

type Draft = Record<string, Record<string, unknown>>;

interface VariableCellProps extends VariableCellInputProps {
  /** Set when the value has a pending change; shown as a highlight + tooltip. */
  pendingFrom?: { value: unknown };
}

const VariableCell = (props: VariableCellProps) => {
  const { pendingFrom, sensitive } = props;
  if (!pendingFrom) return <VariableCellInput {...props} />;
  return (
    <Tooltip
      title={
        sensitive
          ? "Has a pending change"
          : `Pending change. Currently applied: ${JSON.stringify(pendingFrom.value) ?? "not set"}`
      }
    >
      <div className="rounded-surface ring-2 ring-warning/60">
        <VariableCellInput {...props} />
      </div>
    </Tooltip>
  );
};

export interface BatchVariablesEditDialogProps {
  open: boolean;
  onClose: () => void;
  resourceIds: string[];
  /** Called after resources were updated so the caller can refresh its list. */
  onSaved?: () => void;
}

/**
 * Table of the batch's resources and their input variables. Saving updates
 * each changed resource through the regular resource update mutation.
 */
export const BatchVariablesEditDialog = ({
  open,
  onClose,
  resourceIds,
  onSaved,
}: BatchVariablesEditDialogProps) => {
  const { ikApi } = useConfig();
  const [resources, setResources] = useState<BatchResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({});
  const [invalidCells, setInvalidCells] = useState<Set<string>>(new Set());
  const [schemaById, setSchemaById] = useState<SchemaByResource>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDraft({});
    setInvalidCells(new Set());
    setLoading(true);
    ikApi
      .graphqlRequest<{ resources: FetchedResource[] }>(
        `query BatchVariableResources($filter: JSON, $sort: [String!], $range: [Int!]) {
          resources(filter: $filter, sort: $sort, range: $range) {
            id
            name
            state
            variables
            tempState {
              value
            }
            sourceCodeVersion { id }
            project { id }
            parents { id }
          }
        }`,
        {
          filter: { id__in: resourceIds },
          sort: ["name", "ASC"],
          range: [0, Math.max(resourceIds.length, 1)],
        },
      )
      .then(async (response) => {
        const loaded = (response.resources || []).map(toBatchResource);
        const schemas = await fetchSchemas(ikApi, loaded);
        if (cancelled) return;
        setSchemaById(schemas);
        setResources(loaded);
      })
      .catch((error) => {
        if (!cancelled) notifyError(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ikApi, open, resourceIds]);

  // Frozen variables can only change while the resource is still being
  // provisioned (same rule as the resource's own variables editor).
  const isEditable = useCallback(
    (resource: BatchResource, name: string) =>
      !(
        schemaById[resource.id]?.[name]?.frozen &&
        resource.state !== ENTITY_STATE.PROVISION
      ),
    [schemaById],
  );

  const optionsFor = useCallback(
    (resource: BatchResource, name: string) =>
      schemaById[resource.id]?.[name]?.options ?? [],
    [schemaById],
  );

  // Union of variable names. Resources of different templates can share a
  // name with another type; such a column can only be edited per resource.
  const columns = useMemo(() => {
    const byName = new Map<
      string,
      { type: string; sensitive: boolean; mixedType: boolean }
    >();
    resources.forEach((resource) =>
      resource.variables.forEach((variable) => {
        const existing = byName.get(variable.name);
        const type = variable.type || "any";
        byName.set(variable.name, {
          type: existing?.type ?? type,
          sensitive: !!existing?.sensitive || !!variable.sensitive,
          mixedType:
            !!existing && (existing.mixedType || existing.type !== type),
        });
      }),
    );
    return [...byName.entries()]
      .map(([name, meta]) => ({ name, ...meta }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [resources]);

  const currentValue = useCallback(
    (resource: BatchResource, name: string) =>
      resource.variables.find((variable) => variable.name === name)?.value,
    [],
  );

  const effectiveValue = useCallback(
    (resource: BatchResource, name: string) =>
      draft[resource.id] && name in draft[resource.id]
        ? draft[resource.id][name]
        : currentValue(resource, name),
    [currentValue, draft],
  );

  const setCell = useCallback(
    (resource: BatchResource, name: string, value: unknown) => {
      setDraft((prev) => {
        const resourceDraft = { ...(prev[resource.id] ?? {}) };
        if (sameValue(value, currentValue(resource, name))) {
          delete resourceDraft[name];
        } else {
          resourceDraft[name] = value;
        }
        const next = { ...prev, [resource.id]: resourceDraft };
        if (Object.keys(resourceDraft).length === 0) delete next[resource.id];
        return next;
      });
    },
    [currentValue],
  );

  const setColumn = useCallback(
    (name: string, value: unknown) => {
      resources.forEach((resource) => {
        if (
          isEditable(resource, name) &&
          resource.variables.some((variable) => variable.name === name)
        ) {
          setCell(resource, name, value);
        }
      });
    },
    [resources, setCell, isEditable],
  );

  const markValidity = useCallback((cellKey: string, valid: boolean) => {
    setInvalidCells((prev) => {
      if (valid === !prev.has(cellKey)) return prev;
      const next = new Set(prev);
      if (valid) next.delete(cellKey);
      else next.add(cellKey);
      return next;
    });
  }, []);

  const changedCount = Object.keys(draft).length;

  const handleSave = useCallback(async () => {
    const targets = resources.filter((resource) => draft[resource.id]);

    setSaving(true);
    const failed = await runInBatches(targets, (resource) => {
      const changes = draft[resource.id];
      const variables = resource.variables.map((variable) =>
        variable.name in changes
          ? { ...variable, value: changes[variable.name] }
          : variable,
      );
      return ikApi.graphqlRequest(UPDATE_RESOURCE_MUTATION, {
        id: resource.id,
        input: { variables },
      });
    });
    setSaving(false);

    if (targets.length - failed.length > 0) onSaved?.();

    if (failed.length > 0) {
      notifyError(
        new Error(
          `Updated ${targets.length - failed.length}/${targets.length} resources. Failed: ${failed.map((r) => r.name).join(", ")}`,
        ),
      );
      // Keep the dialog open with only the failed resources left to retry.
      const failedIds = new Set(failed.map((r) => r.id));
      setDraft((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([id]) => failedIds.has(id)),
        ),
      );
      return;
    }
    notify(`Updated variables on ${targets.length} resources`, "success");
    onClose();
  }, [draft, ikApi, onClose, onSaved, resources]);

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="xl"
      fullWidth
    >
      <DialogTitle>Edit Variables</DialogTitle>
      <DialogContent>
        <p className="m-0 mb-3 text-body2 text-fg-muted">
          Change values per resource, or use the first row to set a value for
          every resource that has the variable. Resources with pending changes
          show the pending values (highlighted); new edits build on them.
          Changes are applied to each resource when you save.
        </p>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : columns.length === 0 ? (
          <p className="m-0 py-4 text-body2 text-fg-muted">
            The resources in this batch have no input variables.
          </p>
        ) : (
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Resource</TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.name} className="min-w-[180px]">
                      {column.name}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow className="bg-primary/8">
                  <TableCell className="font-medium text-primary">
                    All resources
                  </TableCell>
                  {columns.map((column) => {
                    const holders = resources.filter((resource) =>
                      resource.variables.some((v) => v.name === column.name),
                    );
                    // Bulk-editing is only offered when every resource that
                    // has the variable can change it and they share a type.
                    const allEditable =
                      !column.mixedType &&
                      holders.every((resource) =>
                        isEditable(resource, column.name),
                      );
                    const options = [
                      ...new Set(
                        holders.flatMap((resource) =>
                          optionsFor(resource, column.name),
                        ),
                      ),
                    ];
                    const values = holders.map((resource) =>
                      effectiveValue(resource, column.name),
                    );
                    const uniform = values.every((value) =>
                      sameValue(value, values[0]),
                    );
                    return (
                      <TableCell key={column.name}>
                        <VariableCell
                          type={column.type}
                          sensitive={column.sensitive}
                          value={uniform ? values[0] : undefined}
                          options={options}
                          disabled={!allEditable}
                          placeholder={uniform ? undefined : "Mixed values"}
                          onChange={(value) => setColumn(column.name, value)}
                          onValidityChange={(valid) =>
                            markValidity(`all::${column.name}`, valid)
                          }
                          ariaLabel={`Set ${column.name} for all resources`}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
                {resources.map((resource) => (
                  <TableRow key={resource.id} hover>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{resource.name}</span>
                        {resource.hasPendingChanges && (
                          <Label tone="warning" label="Pending changes" />
                        )}
                      </div>
                    </TableCell>
                    {columns.map((column) => {
                      const own = resource.variables.find(
                        (variable) => variable.name === column.name,
                      );
                      const frozen =
                        !!own && !isEditable(resource, column.name);
                      return (
                        <TableCell key={column.name}>
                          {own ? (
                            <VariableCell
                              disabled={frozen}
                              type={own.type || "any"}
                              sensitive={!!own.sensitive}
                              value={effectiveValue(resource, column.name)}
                              options={optionsFor(resource, column.name)}
                              onChange={(value) =>
                                setCell(resource, column.name, value)
                              }
                              onValidityChange={(valid) =>
                                markValidity(
                                  `${resource.id}::${column.name}`,
                                  valid,
                                )
                              }
                              ariaLabel={`${column.name} for ${resource.name}${frozen ? " (frozen)" : ""}`}
                              pendingFrom={
                                column.name in resource.pendingBaseline
                                  ? {
                                      value:
                                        resource.pendingBaseline[column.name],
                                    }
                                  : undefined
                              }
                            />
                          ) : (
                            <span className="text-fg-muted">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={
            saving || loading || changedCount === 0 || invalidCells.size > 0
          }
        >
          {changedCount > 0
            ? `Save (${changedCount} resource${changedCount === 1 ? "" : "s"})`
            : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
