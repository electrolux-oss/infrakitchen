import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { GqlService } from "../graphql";

interface ServicePermissionsProps {
  service: GqlService;
}

export const ServicePermissions = ({ service }: ServicePermissionsProps) => {
  return (
    <EntityPoliciesTab entityId={service.id} entityName={service.entityName} />
  );
};
