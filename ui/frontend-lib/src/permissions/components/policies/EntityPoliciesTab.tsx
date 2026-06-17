import { OverviewCard } from "../../../common/components/OverviewCard";

import { EntityPoliciesBase } from "./EntityPoliciesBase";

export const EntityPoliciesTab = (props: {
  entityId: string;
  entityName: string;
}) => (
  <OverviewCard>
    <EntityPoliciesBase {...props} />
  </OverviewCard>
);
