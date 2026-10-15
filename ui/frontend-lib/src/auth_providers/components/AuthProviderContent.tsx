import { Audit } from "../../common/components/activity/Audit";
import { DangerZoneCard } from "../../common/components/cards/DangerZoneCard";
import {
  TabbedContent,
  TabDefinition,
} from "../../common/components/cards/TabbedContent";
import { useEntityProvider } from "../../common/context/EntityContext";

import { AuthProviderConfiguration } from "./AuthProviderConfiguration";
import { AuthProviderOverview } from "./AuthProviderOverview";

export const AuthProviderContent = () => {
  const { entity } = useEntityProvider();
  if (!entity) return null;

  const tabs: TabDefinition[] = [
    {
      label: "Configuration",
      content: <AuthProviderConfiguration authProvider={entity} />,
    },
    {
      label: "Audit",
      content: <Audit entityId={entity.id} />,
    },
    {
      label: "Settings",
      content: <DangerZoneCard />,
      requiredPermission: "api:auth_provider",
      permissionAction: "write" as const,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-4">
      <AuthProviderOverview authProvider={entity} />
      <TabbedContent tabs={tabs} />
    </div>
  );
};
