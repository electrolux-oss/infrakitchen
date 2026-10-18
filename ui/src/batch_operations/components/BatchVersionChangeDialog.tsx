import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import VersionLifecycleStateChip from "../../common/VersionLifecycleStateChip";
import {
  RESOURCE_VARIABLE_SCHEMA_QUERY,
  UPDATE_RESOURCE_MUTATION,
} from "../../resources/graphql";
import { ResourceVariableSchema, VariableInput } from "../../resources/types";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "../../ui";
import { VERSION_LIFECYCLE_STATE } from "../../utils/constants";
import { buildSchemaQuery, runInBatches } from "../utils";

import { VariableCellInput } from "./VariableCellInput";

interface FetchedResource {
  id: string;
  name: string;
  variables: VariableInput[] | null;
  tempState: { value: Record<string, any> | null } | null;
  sourceCodeVersion: { id: string; identifier: string } | null;
  template: { id: string; name: string } | null;
  project: { id: string } | null;
  parents: { id: string }[] | null;
}

interface TemplateVersion {
  id: string;
  identifier: string;
  status: string;
  lifecycleState: string;
  breakingChanges: string | null;
  template: { id: string } | null;
}

interface VersionResource {
  id: string;
  name: string;
  templateId: string | null;
  templateName: string;
  /** Version the resource will run once pending changes are applied. */
  versionId: string | null;
  hasPendingVersion: boolean;
  projectId: string | null;
  parentIds: string[];
  variables: VariableInput[];
}

const RESOURCES_QUERY = `
  query BatchVersionResources($filter: JSON, $sort: [String!], $range: [Int!]) {
    resources(filter: $filter, sort: $sort, range: $range) {
      id
      name
      variables
      tempState { value }
      sourceCodeVersion { id identifier }
      template { id name }
      project { id }
      parents { id }
    }
  }
`;

const VERSIONS_QUERY = `
  query BatchTemplateVersions($filter: JSON, $sort: [String!], $range: [Int!]) {
    sourceCodeVersions(filter: $filter, sort: $sort, range: $range) {
      id
      identifier
      status
      lifecycleState
      breakingChanges
      template { id }
    }
  }
`;

/**
 * An edit made while provisioned waits in the temporary state; its
 * `source_code_version_id` and `variables` are what the resource will use.
 */
const toVersionResource = (resource: FetchedResource): VersionResource => {
  const pending = resource.tempState?.value ?? null;
  const hasPendingVersion =
    !!pending &&
    Object.prototype.hasOwnProperty.call(pending, "source_code_version_id");
  const pendingVariables = Array.isArray(pending?.variables)
    ? (pending.variables as VariableInput[])
    : null;
  return {
    id: resource.id,
    name: resource.name,
    templateId: resource.template?.id ?? null,
    templateName: resource.template?.name ?? "No template",
    versionId: hasPendingVersion
      ? ((pending?.source_code_version_id as string | null) ?? null)
      : (resource.sourceCodeVersion?.id ?? null),
    hasPendingVersion,
    projectId: resource.project?.id ?? null,
    parentIds: (resource.parents ?? []).map((parent) => parent.id),
    variables: pendingVariables ?? resource.variables ?? [],
  };
};

/**
 * Variables of the new version's schema: values of variables that already
 * exist are kept, new ones start with the template default and removed ones
 * are dropped (same reconciliation as the single resource editor).
 */
const reconcileVariables = (
  current: VariableInput[],
  schema: ResourceVariableSchema[],
  /** Values the user entered for new variables. */
  overrides: Record<string, unknown> = {},
): VariableInput[] => {
  const currentByName = new Map(current.map((v) => [v.name, v]));
  return [...schema]
    .sort((left, right) => left.index - right.index)
    .map((variable) => {
      const existing = currentByName.get(variable.name);
      return {
        name: variable.name,
        value: existing
          ? existing.value
          : variable.name in overrides
            ? overrides[variable.name]
            : variable.value,
        sensitive: variable.sensitive,
        type: variable.type,
        description: variable.description || "",
      } satisfies VariableInput;
    });
};

/** Variables the new version adds and the ones it no longer has. */
const diffVariables = (
  current: VariableInput[],
  schema: ResourceVariableSchema[],
) => {
  const currentNames = new Set(current.map((v) => v.name));
  const schemaNames = new Set(schema.map((v) => v.name));
  return {
    added: schema
      .filter((v) => !currentNames.has(v.name))
      .sort((left, right) => left.index - right.index),
    removed: current.filter((v) => !schemaNames.has(v.name)),
  };
};

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === "";

interface LoadedSchema {
  versionId: string;
  variables: ResourceVariableSchema[];
}

interface VariableChangesProps {
  change: ReturnType<typeof diffVariables>;
  valueOf: (variable: ResourceVariableSchema) => unknown;
  onChange: (variable: ResourceVariableSchema, value: unknown) => void;
  disabled: boolean;
}

/** New variables (editable, prefilled with the default) and removed ones. */
const VariableChanges = ({
  change,
  valueOf,
  onChange,
  disabled,
}: VariableChangesProps) => (
  <div className="flex flex-col gap-2">
    {change.added.map((variable) => (
      <div key={variable.name} className="flex flex-wrap items-center gap-3">
        <Chip size="small" color="success" label="New" />
        <span className="min-w-40 text-body2">
          {variable.name}
          {variable.required ? " *" : ""}
        </span>
        <div className="min-w-60">
          <VariableCellInput
            type={variable.type}
            sensitive={variable.sensitive}
            value={valueOf(variable)}
            options={variable.options}
            disabled={disabled}
            onChange={(value) => onChange(variable, value)}
            ariaLabel={`New variable ${variable.name}`}
          />
        </div>
        {variable.description && (
          <span className="text-caption text-fg-muted">
            {variable.description}
          </span>
        )}
      </div>
    ))}
    {change.removed.length > 0 && (
      <div className="flex flex-wrap items-center gap-2">
        <Chip size="small" color="error" label="Removed" />
        {change.removed.map((variable) => (
          <span
            key={variable.name}
            className="text-body2 text-fg-muted line-through"
          >
            {variable.name}
          </span>
        ))}
      </div>
    )}
  </div>
);

export interface BatchVersionChangeDialogProps {
  open: boolean;
  onClose: () => void;
  resourceIds: string[];
  /** Called after at least one resource was updated. */
  onSaved?: () => void;
}

/**
 * Move the resources of a batch to another template version. Resources are
 * grouped by template, since a version belongs to one template; each group
 * has a row to set every resource of it at once.
 */
export const BatchVersionChangeDialog = ({
  open,
  onClose,
  resourceIds,
  onSaved,
}: BatchVersionChangeDialogProps) => {
  const { ikApi } = useConfig();
  const [resources, setResources] = useState<VersionResource[]>([]);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Chosen version per resource id; only differing ones are kept. */
  const [draft, setDraft] = useState<Record<string, string>>({});
  /** Schema of the chosen version per resource id. */
  const [schemas, setSchemas] = useState<Record<string, LoadedSchema>>({});
  const [schemaLoading, setSchemaLoading] = useState(false);
  /** Values entered for variables the new version adds, per resource id. */
  const [newValues, setNewValues] = useState<
    Record<string, Record<string, unknown>>
  >({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setDraft({});
      setSchemas({});
      setNewValues({});
      if (resourceIds.length === 0) {
        setResources([]);
        setVersions([]);
        return;
      }
      setLoading(true);
      try {
        const { resources: fetched } = await ikApi.graphqlRequest<{
          resources: FetchedResource[];
        }>(RESOURCES_QUERY, {
          filter: { id__in: resourceIds },
          sort: ["name", "ASC"],
          range: [0, resourceIds.length],
        });
        const mapped = (fetched ?? []).map(toVersionResource);
        const templateIds = [
          ...new Set(mapped.map((r) => r.templateId).filter(Boolean)),
        ] as string[];
        let fetchedVersions: TemplateVersion[] = [];
        if (templateIds.length > 0) {
          const response = await ikApi.graphqlRequest<{
            sourceCodeVersions: TemplateVersion[];
          }>(VERSIONS_QUERY, {
            filter: { template_id: templateIds },
            sort: ["index", "DESC"],
            range: [0, 500],
          });
          fetchedVersions = response.sourceCodeVersions ?? [];
        }
        if (cancelled) return;
        setResources(mapped);
        setVersions(fetchedVersions);
      } catch (error) {
        notifyError(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, ikApi, resourceIds]);

  const versionsByTemplate = useMemo(() => {
    const result = new Map<string, TemplateVersion[]>();
    versions.forEach((version) => {
      const templateId = version.template?.id;
      if (!templateId) return;
      result.set(templateId, [...(result.get(templateId) ?? []), version]);
    });
    return result;
  }, [versions]);

  const versionById = useMemo(
    () => new Map(versions.map((version) => [version.id, version])),
    [versions],
  );

  const groups = useMemo(() => {
    const result = new Map<string, VersionResource[]>();
    resources.forEach((resource) => {
      const key = resource.templateId ?? "";
      result.set(key, [...(result.get(key) ?? []), resource]);
    });
    return [...result.entries()];
  }, [resources]);

  // Load the schema of every chosen version so the variable changes show up.
  useEffect(() => {
    const missing = resources.filter(
      (resource) =>
        draft[resource.id] &&
        schemas[resource.id]?.versionId !== draft[resource.id],
    );
    if (missing.length === 0) {
      // A cancelled earlier request may have left the flag set.
      setSchemaLoading(false);
      return;
    }
    let cancelled = false;
    const { query, variables } = buildSchemaQuery(
      "BatchVersionSchemas",
      missing.map((resource) => ({
        sourceCodeVersionId: draft[resource.id],
        parentIds: resource.parentIds,
        projectId: resource.projectId,
      })),
      "name type description options required restricted sensitive frozen unique value index",
    );
    setSchemaLoading(true);
    ikApi
      .graphqlRequest<Record<string, ResourceVariableSchema[]>>(
        query,
        variables,
      )
      .then((response) => {
        if (cancelled) return;
        setSchemas((prev) => ({
          ...prev,
          ...Object.fromEntries(
            missing.map((resource, i) => [
              resource.id,
              {
                versionId: draft[resource.id],
                variables: (response[`s${i}`] ?? []).map((variable) => ({
                  ...variable,
                  description: variable.description || "",
                })),
              },
            ]),
          ),
        }));
      })
      .catch(notifyError)
      .finally(() => {
        if (!cancelled) setSchemaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [draft, resources, schemas, ikApi]);

  const choose = useCallback(
    (targets: VersionResource[], versionId: string) => {
      setDraft((prev) => {
        const next = { ...prev };
        targets.forEach((resource) => {
          if (versionId === resource.versionId) delete next[resource.id];
          else next[resource.id] = versionId;
        });
        return next;
      });
      setNewValues((prev) => {
        const next = { ...prev };
        targets.forEach((resource) => delete next[resource.id]);
        return next;
      });
    },
    [],
  );

  const changedCount = Object.keys(draft).length;

  const changesById = useMemo(() => {
    const result: Record<string, ReturnType<typeof diffVariables>> = {};
    resources.forEach((resource) => {
      const loaded = schemas[resource.id];
      if (draft[resource.id] && loaded?.versionId === draft[resource.id]) {
        result[resource.id] = diffVariables(
          resource.variables,
          loaded.variables,
        );
      }
    });
    return result;
  }, [resources, draft, schemas]);

  const valueOfNew = (resourceId: string, variable: ResourceVariableSchema) =>
    variable.name in (newValues[resourceId] ?? {})
      ? newValues[resourceId][variable.name]
      : variable.value;

  /** Required new variables still without a value block saving. */
  const missingRequired = useMemo(
    () =>
      Object.entries(changesById).some(([id, change]) =>
        change.added.some(
          (variable) =>
            variable.required &&
            isEmpty(
              variable.name in (newValues[id] ?? {})
                ? newValues[id][variable.name]
                : variable.value,
            ),
        ),
      ),
    [changesById, newValues],
  );

  const warnings = useMemo(() => {
    const chosen = new Set(Object.values(draft));
    return [...chosen]
      .map((id) => versionById.get(id))
      .filter((version): version is TemplateVersion => !!version)
      .map((version) => ({
        id: version.id,
        identifier: version.identifier,
        deprecated:
          version.lifecycleState?.toLowerCase() ===
          VERSION_LIFECYCLE_STATE.DEPRECATED,
        breaking: version.breakingChanges?.trim() || null,
      }))
      .filter((warning) => warning.deprecated || warning.breaking);
  }, [draft, versionById]);

  const handleSave = useCallback(async () => {
    const targets = resources.filter((resource) => draft[resource.id]);

    setSaving(true);
    const failed = await runInBatches(targets, async (resource) => {
      const sourceCodeVersionId = draft[resource.id];
      const loaded = schemas[resource.id];
      const resourceVariableSchema =
        loaded?.versionId === sourceCodeVersionId
          ? loaded.variables
          : (
              await ikApi.graphqlRequest<{
                resourceVariableSchema: ResourceVariableSchema[];
              }>(RESOURCE_VARIABLE_SCHEMA_QUERY, {
                sourceCodeVersionId,
                parentResourceIds: resource.parentIds,
                projectId: resource.projectId,
              })
            ).resourceVariableSchema;
      await ikApi.graphqlRequest(UPDATE_RESOURCE_MUTATION, {
        id: resource.id,
        input: {
          sourceCodeVersionId,
          variables: reconcileVariables(
            resource.variables,
            resourceVariableSchema,
            newValues[resource.id],
          ),
        },
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
    notify(
      `Changed template version on ${targets.length} resources`,
      "success",
    );
    onClose();
  }, [draft, ikApi, newValues, onClose, onSaved, resources, schemas]);

  const renderSelect = (
    targets: VersionResource[],
    templateId: string,
    value: string,
    placeholder?: string,
  ) => (
    <Select
      value={value}
      displayEmpty
      variant="outlined"
      size="small"
      disabled={saving}
      onChange={(e) => choose(targets, String(e.target.value))}
      aria-label="Template version"
    >
      {placeholder && (
        <MenuItem value="" disabled>
          {placeholder}
        </MenuItem>
      )}
      {(versionsByTemplate.get(templateId) ?? []).map((version) => (
        <MenuItem
          key={version.id}
          value={version.id}
          disabled={version.status !== "done"}
        >
          <span className="inline-flex items-center gap-2">
            <VersionLifecycleStateChip
              lifecycleState={version.lifecycleState}
              breakingChanges={version.breakingChanges ?? undefined}
              variant="dot"
            />
            {version.identifier}
          </span>
        </MenuItem>
      ))}
    </Select>
  );

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>Change Template Version</DialogTitle>
      <DialogContent>
        <p className="m-0 mb-3 text-body2 text-fg-muted">
          Pick a template version per resource, or use a template row to move
          all of its resources at once. Variables are reconfigured to the new
          version&apos;s schema: values are kept, new variables are listed under
          the resource (fill in the required ones) and removed ones are dropped.
          Changes are applied to each resource when you save.
        </p>
        {warnings.map((warning) => (
          <Alert key={warning.id} className="mb-2" severity="warning">
            <p className="m-0 text-body2">
              {warning.deprecated
                ? `${warning.identifier} is deprecated. `
                : ""}
              {warning.breaking
                ? `${warning.identifier} has breaking changes:`
                : ""}
            </p>
            {warning.breaking}
          </Alert>
        ))}
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : resources.length === 0 ? (
          <p className="m-0 py-4 text-body2 text-fg-muted">
            There are no resources in this batch.
          </p>
        ) : (
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Resource</TableCell>
                  <TableCell>Current version</TableCell>
                  <TableCell className="min-w-[220px]">New version</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.map(([templateId, members]) => {
                  const groupValues = new Set(
                    members.map((m) => draft[m.id] ?? m.versionId ?? ""),
                  );
                  return [
                    <TableRow
                      key={`template-${templateId}`}
                      className="bg-primary/8"
                    >
                      <TableCell className="font-medium text-primary">
                        {`All ${members[0].templateName} resources (${members.length})`}
                      </TableCell>
                      <TableCell />
                      <TableCell>
                        {templateId ? (
                          renderSelect(
                            members,
                            templateId,
                            groupValues.size === 1 ? [...groupValues][0] : "",
                            groupValues.size === 1 ? undefined : "Mixed",
                          )
                        ) : (
                          <span className="text-body2 text-fg-muted">
                            No template
                          </span>
                        )}
                      </TableCell>
                    </TableRow>,
                    ...members.flatMap((resource) => [
                      <TableRow key={resource.id}>
                        <TableCell>
                          {resource.name}
                          {resource.hasPendingVersion && (
                            <Chip
                              className="ml-2"
                              size="small"
                              color="warning"
                              label="Pending version"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const current = resource.versionId
                              ? versionById.get(resource.versionId)
                              : undefined;
                            return current ? (
                              <span className="inline-flex items-center gap-2">
                                <VersionLifecycleStateChip
                                  lifecycleState={current.lifecycleState}
                                  breakingChanges={
                                    current.breakingChanges ?? undefined
                                  }
                                  variant="dot"
                                />
                                {current.identifier}
                              </span>
                            ) : (
                              "-"
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {templateId
                            ? renderSelect(
                                [resource],
                                templateId,
                                draft[resource.id] ?? resource.versionId ?? "",
                              )
                            : null}
                        </TableCell>
                      </TableRow>,
                      ...(changesById[resource.id] &&
                      (changesById[resource.id].added.length > 0 ||
                        changesById[resource.id].removed.length > 0)
                        ? [
                            <TableRow key={`${resource.id}-changes`}>
                              <TableCell colSpan={3} className="bg-hover">
                                <VariableChanges
                                  change={changesById[resource.id]}
                                  valueOf={(variable) =>
                                    valueOfNew(resource.id, variable)
                                  }
                                  onChange={(variable, value) =>
                                    setNewValues((prev) => ({
                                      ...prev,
                                      [resource.id]: {
                                        ...prev[resource.id],
                                        [variable.name]: value,
                                      },
                                    }))
                                  }
                                  disabled={saving}
                                />
                              </TableCell>
                            </TableRow>,
                          ]
                        : []),
                    ]),
                  ];
                })}
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
            saving ||
            loading ||
            schemaLoading ||
            changedCount === 0 ||
            missingRequired
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
