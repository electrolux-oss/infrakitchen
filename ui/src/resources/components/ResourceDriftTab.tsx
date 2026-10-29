import { BaseCard } from "../../common/components/cards/BaseCard";
import { DriftLabel } from "../../common/components/labels";
import { useEntityProvider } from "../../common/context/EntityContext";
import { DRIFT_STATUS } from "../../utils/constants";

/**
 * Result of the last drift check: whether the real infrastructure still
 * matches the state, and which objects were changed outside of InfraKitchen.
 */
export const ResourceDriftTab = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const driftStatus = entity.drift?.status?.toLowerCase();
  const summary = entity.drift?.summary ?? {};
  const addresses: string[] = Array.isArray(summary.resources)
    ? summary.resources
    : [];

  return (
    <BaseCard
      name="Drift"
      description="Compared with a refresh-only plan, nothing is changed by the check"
      actions={
        <DriftLabel
          driftStatus={entity.drift?.status}
          checkedAt={entity.drift?.checkedAt}
        />
      }
    >
      <div className="col-span-full flex flex-col gap-3">
        {driftStatus === DRIFT_STATUS.IN_SYNC && (
          <p className="m-0 text-body2">
            The infrastructure matches the state.
          </p>
        )}
        {driftStatus === DRIFT_STATUS.ERROR && (
          <p className="m-0 text-body2">
            The last check failed: {String(summary.error ?? "unknown error")}.
            See the Logs tab for details.
          </p>
        )}
        {driftStatus === DRIFT_STATUS.DRIFTED && (
          <>
            <p className="m-0 text-body2">
              {addresses.length} object{addresses.length === 1 ? "" : "s"}{" "}
              changed outside of InfraKitchen
              {(summary.resourcesTruncated ?? summary.resources_truncated)
                ? " (list truncated)"
                : ""}
              . Apply the resource to bring them back to the configuration, or
              update the configuration to match.
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {addresses.map((address) => (
                <li key={address} className="font-mono text-body2">
                  {address}
                </li>
              ))}
            </ul>
          </>
        )}
        {entity.driftCheckedAt && (
          <p className="m-0 text-caption text-fg-muted">
            Last checked {new Date(entity.driftCheckedAt).toLocaleString()}
          </p>
        )}
      </div>
    </BaseCard>
  );
};
