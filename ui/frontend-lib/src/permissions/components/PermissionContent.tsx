import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import { useEntityProvider } from "../../common/context/EntityContext";
import { PermissionResponse } from "../types";

import { PermissionOverview } from "./PermissionOverview";

export interface PermissionContentProps {
  permission: PermissionResponse;
}

export const PermissionContent = () => {
  const { entity } = useEntityProvider();
  return (
    <div className="flex w-full flex-col gap-4">
      <PermissionOverview permission={entity} />
      <DangerZoneCard />
    </div>
  );
};
