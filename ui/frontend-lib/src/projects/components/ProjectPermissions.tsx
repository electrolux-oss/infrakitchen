import { EntityPoliciesTab } from "../../permissions/components/policies/EntityPoliciesTab";
import { GqlProject } from "../graphql";

interface ProjectPermissionsProps {
  project: GqlProject;
}

export const ProjectPermissions = ({ project }: ProjectPermissionsProps) => {
  return (
    <EntityPoliciesTab entityId={project.id} entityName={project.entityName} />
  );
};
