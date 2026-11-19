import { useEffect, useState } from "react";

import { ActionButton } from "../../common/components/buttons/ActionButton";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { CommonDialog } from "../../common/components/dialogs/CommonDialog";
import { DriftLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notifyError } from "../../common/hooks/useNotification";
import { Button } from "../../ui";
import { cn } from "../../utils/cn";
import { DRIFT_STATUS, ENTITY_ACTION } from "../../utils/constants";

import { DriftChange, DriftChangesTable } from "./DriftChangesTable";

/** Saved drift result; the keys are the ones the server stores (snake_case). */
interface DriftSummary {
  drifted?: boolean;
  total?: number;
  /** "apply": no check ran, a successful apply set the resource in sync */
  source?: "json" | "text" | "apply";
  changes?: DriftChange[];
  changes_truncated?: boolean;
}

const DRIFT_SUMMARY_QUERY = `
  query ResourceDriftSummary($id: UUID!) {
    resource(id: $id) {
      drift {
        summary
      }
    }
  }
`;

/**
 * The change list of the last drift check. It can be large, so it isn't part
 * of the resource query; it is fetched again when `version` changes.
 */
const useDriftSummary = (resourceId: string, version: string) => {
  const { ikApi } = useConfig();
  const [summary, setSummary] = useState<DriftSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    ikApi
      .graphqlRequest<{
        resource: { drift: { summary: DriftSummary | null } | null } | null;
      }>(DRIFT_SUMMARY_QUERY, { id: resourceId })
      .then((response) => {
        if (!cancelled) setSummary(response?.resource?.drift?.summary ?? null);
      })
      .catch((error) => {
        if (!cancelled) notifyError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [ikApi, resourceId, version]);

  return summary;
};

const formatTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : null;

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

export const ResourceDriftTab = () => {
  const { entity, actions } = useEntityProvider();
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const drift = entity?.drift;
  // a new result or an apply changes the summary, a failed check doesn't
  const summary = useDriftSummary(
    entity?.id,
    `${drift?.status}|${drift?.checkedAt}`,
  );
  if (!drift) return null;

  // GraphQL returns enum names (DRIFTED), live events return values (drifted)
  const status = drift.status?.toLowerCase();
  // a failed apply after the result may have changed the infrastructure
  const outdated = status === DRIFT_STATUS.UNKNOWN;
  const applied = summary?.source === "apply";
  const drifted = status === DRIFT_STATUS.DRIFTED;
  const neverSucceeded = status === DRIFT_STATUS.ERROR;
  const failures = Number(drift.consecutiveFailures ?? 0);
  const changes = summary?.changes ?? [];
  const total = Number(summary?.total ?? changes.length);
  const canCheck = actions.includes(ENTITY_ACTION.CHECK_DRIFT);
  const canReconcile = drifted && actions.includes(ENTITY_ACTION.EXECUTE);
  const checkedAt = formatTime(drift.checkedAt);
  const firstDetectedAt = formatTime(drift.firstDetectedAt);
  const lastErrorAt = formatTime(drift.lastErrorAt);

  return (
    <BaseCard
      name="Drift"
      description="What the next apply would change, found by a plan against the real infrastructure; the check changes nothing"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <DriftLabel
            driftStatus={drift.status}
            checkedAt={drift.checkedAt}
            consecutiveFailures={failures}
            lastError={drift.lastError}
          />
          {canCheck && (
            <ActionButton
              action={ENTITY_ACTION.CHECK_DRIFT}
              onSubmit={() => {}}
            >
              Check drift
            </ActionButton>
          )}
          {canReconcile && (
            <Button
              size="small"
              variant="contained"
              onClick={() => setReconcileOpen(true)}
            >
              Reconcile
            </Button>
          )}
        </div>
      }
    >
      <div className="col-span-full flex flex-col gap-3">
        {failures > 0 && (
          <p className="m-0 text-body2">
            {neverSucceeded
              ? "The drift check failed"
              : `The last ${failures === 1 ? "check" : plural(failures, "check")} failed, the result below is from the last successful one`}
            {lastErrorAt && ` (${lastErrorAt})`}:{" "}
            {drift.lastError ?? "unknown error"}. See the Logs tab for details.
          </p>
        )}
        {outdated && (
          <p className="m-0 text-body2">
            An apply failed after this result, so it may be outdated.
          </p>
        )}
        {status === DRIFT_STATUS.IN_SYNC && (
          <p className="m-0 text-body2">
            The infrastructure matches the configuration.
          </p>
        )}
        {(drifted || (outdated && summary?.drifted)) && (
          <div className={cn("flex flex-col gap-3", outdated && "opacity-60")}>
            <p className="m-0 text-body2">
              {plural(total, "object")} would be changed by an apply
              {summary?.changes_truncated ? " (list truncated)" : ""}.
              {drifted &&
                " Reconcile to set them back to the configuration, or update the configuration to keep the real values."}
            </p>
            {summary?.source === "text" && (
              <p className="m-0 text-caption text-fg-muted">
                The attribute details could not be read, only the changed
                objects are listed.
              </p>
            )}
            <DriftChangesTable changes={changes} />
          </div>
        )}
        <p className="m-0 text-caption text-fg-muted">
          {checkedAt &&
            !neverSucceeded &&
            (applied
              ? `Matched the configuration after the apply at ${checkedAt}.`
              : `Last successful check ${checkedAt}.`)}
          {drifted && firstDetectedAt && ` Drifted since ${firstDetectedAt}.`}
        </p>
      </div>

      <CommonDialog
        title="Reconcile drift"
        maxWidth="sm"
        content={
          <p className="m-0 text-body2">
            Apply the configuration of the resource: changed objects are set
            back to the configured values and deleted objects are created again.
            Run a dry run first to review the plan.
          </p>
        }
        actions={
          <>
            <ActionButton
              action={ENTITY_ACTION.DRYRUN}
              onSubmit={() => setReconcileOpen(false)}
            >
              Dry run
            </ActionButton>
            <ActionButton
              action={ENTITY_ACTION.EXECUTE}
              onSubmit={() => setReconcileOpen(false)}
              color="error"
              variant="contained"
            >
              Apply
            </ActionButton>
          </>
        }
        open={reconcileOpen}
        onClose={() => setReconcileOpen(false)}
      />
    </BaseCard>
  );
};
