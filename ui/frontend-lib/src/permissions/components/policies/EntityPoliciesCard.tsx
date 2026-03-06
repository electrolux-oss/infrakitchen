import { capitalizeFirstLetter } from "../../../common/components/CommonField";
import { PropertyCollapseCard } from "../../../common/components/PropertyCollapseCard";

import { EntityPoliciesBase } from "./EntityPoliciesBase";

export const EntityPoliciesCard = (props: {
  entity_id: string;
  entity_name: string;
}) => (
  <PropertyCollapseCard
    title={`${capitalizeFirstLetter(props.entity_name)} Policy List`}
    expanded={true}
    id="role-policies"
  >
    <EntityPoliciesBase {...props} />
  </PropertyCollapseCard>
);
