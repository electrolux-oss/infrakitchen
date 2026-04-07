import { OverviewCard } from "../../../common/components/OverviewCard";

import { EntityPoliciesBase } from "./EntityPoliciesBase";

export const EntityPoliciesTab = (props: {
  entity_id: string;
  entity_name: string;
}) => (
  <OverviewCard>
    <EntityPoliciesBase {...props} />
  </OverviewCard>
);
