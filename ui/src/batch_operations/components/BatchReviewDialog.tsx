import { useCallback, useEffect, useMemo, useState } from "react";

import { DiffEditor } from "../../common/components/activity/DiffEditor";
import { StatusLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context/ConfigContext";
import { buildEntityActionMutation } from "../../common/graphql/entityActionMutation";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { VariableInput } from "../../resources/types";
import { hasPendingChanges } from "../../resources/utils/pendingChanges";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Spinner,
} from "../../ui";
import { ENTITY_ACTION } from "../../utils/constants";
import { runInBatches, sameValue } from "../utils";

interface ReviewResource {
  id: string;
  name: string;
  state: string;
  status: string;
  tempState: { value: Record<string, any> | null } | null;
  [key: string]: any;
}

const SNAKE_TO_CAMEL_RE = /_([a-z])/g;
const toCamel = (key: string) =>
  key.replace(SNAKE_TO_CAMEL_RE, (_, c: string) => c.toUpperCase());

const idOf = (item: any) => (item && typeof item === "object" ? item.id : item);

/**
 * The applied value of a temp-state key, in the same shape the temp state
 * stores it (ids instead of expanded relations).
 */
const appliedValue = (resource: ReviewResource, key: string) => {
  const camel = toCamel(key);
  if (camel in resource) {
    const value = resource[camel];
    // Only relation lists (integration_ids, ...) are stored as plain ids.
    return key.endsWith("_ids") && Array.isArray(value)
      ? value.map(idOf)
      : value;
  }
  if (key.endsWith("_id")) {
    const relation = resource[toCamel(key.slice(0, -3))];
    return relation ? idOf(relation) : null;
  }
  return undefined;
};

const MASKED = "••••••";

interface ResourceDiff {
  original: string;
  modified: string;
}

/**
 * The applied and pending values of only what changed: variables keyed by
 * name (added ones are missing from the original, removed ones from the new
 * side) and other fields keyed by their temp-state key. Null if nothing
 * differs.
 */
const calculateDiff = (resource: ReviewResource): ResourceDiff | null => {
  const pending = resource.tempState?.value ?? {};
  const original: Record<string, unknown> = {};
  const modified: Record<string, unknown> = {};

  Object.entries(pending).forEach(([key, nextValue]) => {
    if (key === "variables" && Array.isArray(nextValue)) {
      const current = new Map<string, VariableInput>(
        ((resource.variables as VariableInput[] | null) ?? []).map((v) => [
          v.name,
          v,
        ]),
      );
      const next = new Map<string, VariableInput>(
        (nextValue as VariableInput[]).map((v) => [v.name, v]),
      );
      [...new Set([...current.keys(), ...next.keys()])]
        .sort()
        .forEach((name) => {
          const before = current.get(name);
          const after = next.get(name);
          if (before && after && sameValue(before.value, after.value)) return;
          const sensitive = !!(before?.sensitive || after?.sensitive);
          if (before) original[name] = sensitive ? MASKED : before.value;
          if (after) modified[name] = sensitive ? MASKED : after.value;
        });
      return;
    }

    const before = appliedValue(resource, key);
    if (before !== undefined && sameValue(before, nextValue)) return;
    if (before !== undefined) original[key] = before;
    modified[key] = nextValue;
  });

  if (
    Object.keys(original).length === 0 &&
    Object.keys(modified).length === 0
  ) {
    return null;
  }
  return {
    original: JSON.stringify(original, null, 2),
    modified: JSON.stringify(modified, null, 2),
  };
};

const REVIEW_QUERY = `
  query BatchReviewResources($filter: JSON, $sort: [String!], $range: [Int!]) {
    resources(filter: $filter, sort: $sort, range: $range) {
      id
      name
      description
      state
      status
      variables
      dependencyTags
      dependencyConfig
      labels
      storagePath
      sourceCodeVersion { id }
      integrationIds { id }
      secretIds { id }
      storage { id }
      tool { id }
      workspace { id }
      project { id }
      tempState { value }
    }
  }
`;

export interface BatchReviewDialogProps {
  open: boolean;
  onClose: () => void;
  /** Resources of the batch that have pending changes. */
  resourceIds: string[];
  /** Called after an approve/reject so the caller can refresh its list. */
  onChanged: () => void;
}

/**
 * Review the pending (temporary state) changes of every resource in the
 * batch, one after another, with the same diff the resource page shows.
 */
export const BatchReviewDialog = ({
  open,
  onClose,
  resourceIds,
  onChanged,
}: BatchReviewDialogProps) => {
  const { ikApi } = useConfig();
  const [resources, setResources] = useState<ReviewResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [actionsById, setActionsById] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    if (resourceIds.length === 0) {
      setResources([]);
      return;
    }
    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        resources: ReviewResource[];
      }>(REVIEW_QUERY, {
        filter: { id__in: resourceIds },
        sort: ["name", "ASC"],
        range: [0, resourceIds.length],
      });
      const pending = (response.resources || []).filter(hasPendingChanges);
      setResources(pending);

      // What the requester may do with each resource (approve/reject need
      // the matching action).
      if (pending.length === 0) {
        setActionsById({});
      } else {
        // One aliased query for every resource: a0: resourceActions(id: $id0)
        const variableDefs = pending.map((_, i) => `$id${i}: UUID!`).join(", ");
        const selections = pending
          .map((_, i) => `a${i}: resourceActions(id: $id${i})`)
          .join("\n");
        const variables = Object.fromEntries(
          pending.map((resource, i) => [`id${i}`, resource.id]),
        );
        try {
          const actions = await ikApi.graphqlRequest<Record<string, string[]>>(
            `query BatchReviewActions(${variableDefs}) {\n${selections}\n}`,
            variables,
          );
          setActionsById(
            Object.fromEntries(
              pending.map((resource, i) => [
                resource.id,
                actions[`a${i}`] || [],
              ]),
            ),
          );
        } catch {
          setActionsById({});
        }
      }
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi, resourceIds]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const diffsById = useMemo(
    () =>
      Object.fromEntries(
        resources.map((resource) => [resource.id, calculateDiff(resource)]),
      ) as Record<string, ResourceDiff | null>,
    [resources],
  );

  const canDecideResource = useCallback(
    (resource: ReviewResource | undefined, action: ENTITY_ACTION) =>
      !!resource && !!actionsById[resource.id]?.includes(action),
    [actionsById],
  );

  const approvable = resources.filter((resource) =>
    canDecideResource(resource, ENTITY_ACTION.APPROVE),
  );

  const rejectable = resources.filter((resource) =>
    canDecideResource(resource, ENTITY_ACTION.REJECT),
  );

  const decide = useCallback(
    async (
      targets: ReviewResource[],
      action: ENTITY_ACTION.APPROVE | ENTITY_ACTION.REJECT,
    ) => {
      if (targets.length === 0) return;
      setActing(true);
      const verb = action === ENTITY_ACTION.APPROVE ? "approved" : "rejected";
      const failed = await runInBatches(targets, (target) =>
        ikApi.graphqlRequest(buildEntityActionMutation("resource"), {
          id: target.id,
          input: { action },
        }),
      );
      if (failed.length > 0) {
        notifyError(
          new Error(
            `${targets.length - failed.length}/${targets.length} ${verb}. Failed: ${failed.map((t) => t.name).join(", ")}`,
          ),
        );
      } else {
        notify(`${targets.length} resource(s) ${verb}`, "success");
      }
      onChanged();
      await load();
      setActing(false);
    },
    [ikApi, load, onChanged],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle>Review Changes</DialogTitle>
      <DialogContent>
        {loading && resources.length === 0 ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : resources.length === 0 ? (
          <p className="m-0 py-4 text-body2 text-fg-muted">
            No resources in this batch have pending changes.
          </p>
        ) : (
          <div className="rounded-surface border border-divider bg-paper text-fg">
            <div className="grid min-w-300 grid-cols-[1fr_1fr] border-b border-divider">
              <h6 className="m-0 px-4 py-3 text-subtitle2 text-grey-500">
                Current State
              </h6>
              <h6 className="m-0 px-4 py-3 text-subtitle2 text-grey-500">
                Updated State
              </h6>
            </div>
            <div className="max-h-[65vh] overflow-auto">
              {resources.map((resource) => {
                const diff = diffsById[resource.id];
                const canApprove = canDecideResource(
                  resource,
                  ENTITY_ACTION.APPROVE,
                );
                const canReject = canDecideResource(
                  resource,
                  ENTITY_ACTION.REJECT,
                );
                return (
                  <section
                    key={resource.id}
                    className="border-b border-divider last:border-b-0"
                  >
                    <div className="flex flex-wrap items-center gap-3 bg-hover px-4 py-2">
                      <span className="text-body2 font-medium">
                        {resource.name}
                      </span>
                      <StatusLabel
                        status={String(resource.status).toLowerCase()}
                        state={String(resource.state).toLowerCase()}
                        compact
                      />
                      <div className="ml-auto flex items-center gap-2">
                        {canApprove && (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={acting}
                            onClick={() =>
                              decide([resource], ENTITY_ACTION.APPROVE)
                            }
                          >
                            Approve
                          </Button>
                        )}
                        {canReject && (
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            disabled={acting}
                            onClick={() =>
                              decide([resource], ENTITY_ACTION.REJECT)
                            }
                          >
                            Reject
                          </Button>
                        )}
                        {!canApprove && !canReject && (
                          <span className="text-caption text-fg-muted">
                            No permission to review
                          </span>
                        )}
                      </div>
                    </div>
                    {diff ? (
                      <div className="w-full overflow-auto [&_.cm-mergeView]:min-w-300">
                        <DiffEditor
                          splitView
                          highlightChanges={false}
                          originalText={diff.original}
                          modifiedText={diff.modified}
                        />
                      </div>
                    ) : (
                      <p className="m-0 px-4 py-3 text-body2 text-fg-muted">
                        No differences from the applied values.
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
      <DialogActions>
        {rejectable.length > 1 && (
          <Button
            color="error"
            disabled={acting}
            onClick={() => decide(rejectable, ENTITY_ACTION.REJECT)}
          >
            {`Reject all (${rejectable.length})`}
          </Button>
        )}
        {approvable.length > 1 && (
          <Button
            disabled={acting}
            onClick={() => decide(approvable, ENTITY_ACTION.APPROVE)}
          >
            {`Approve all (${approvable.length})`}
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
