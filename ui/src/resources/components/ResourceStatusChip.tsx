import { DriftLabel, EntityStatusChip } from "../../common/components/labels";
import { useEntityProvider } from "../../common/context/EntityContext";

/** The page-header status of a resource, with the result of its last drift check. */
export const ResourceStatusChip = () => {
  const { entity } = useEntityProvider();
  if (!entity?.status) return null;

  return (
    <EntityStatusChip status={entity.status} state={entity.state}>
      <DriftLabel
        driftStatus={entity.drift?.status}
        checkedAt={entity.drift?.checkedAt}
        consecutiveFailures={entity.drift?.consecutiveFailures}
        lastError={entity.drift?.lastError}
        size="large"
      />
    </EntityStatusChip>
  );
};
