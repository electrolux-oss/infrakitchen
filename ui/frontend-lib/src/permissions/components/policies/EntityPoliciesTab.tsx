import { capitalizeFirstLetter } from "../../../common/components/CommonField";
import { OverviewCard } from "../../../common/components/OverviewCard";

import { EntityPoliciesBase } from "./EntityPoliciesBase";

export const EntityPoliciesTab = (props: {
  entity_id: string;
  entity_name: string;
}) => (
  <OverviewCard
    name={`${capitalizeFirstLetter(props.entity_name)} Policy List`}
  >
    <EntityPoliciesBase {...props} />
  </OverviewCard>
);
