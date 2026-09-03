import { BaseCard } from "../../../common/components/BaseCard";

import { EntityPoliciesBase } from "./EntityPoliciesBase";

export const EntityPoliciesTab = (props: {
  entityId: string;
  entityName: string;
  inheritedEntityIds?: string[];
}) => (
  <BaseCard>
    <EntityPoliciesBase {...props} />
  </BaseCard>
);
