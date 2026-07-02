import { capitalizeFirstLetter } from "../../../common/components/CommonField";
import { PropertyCollapseCard } from "../../../common/components/PropertyCollapseCard";

import { EntityPoliciesBase } from "./EntityPoliciesBase";

export const EntityPoliciesCard = (props: {
  entityId: string;
  entityName: string;
}) => (
  <PropertyCollapseCard
    title={`${capitalizeFirstLetter(props.entityName)} Policy List`}
    expanded={true}
    id="role-policies"
  >
    <EntityPoliciesBase {...props} />
  </PropertyCollapseCard>
);
