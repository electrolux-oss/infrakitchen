import { Alert, Box } from "@mui/material";

import { ApiPoliciesCard } from "../../permissions/components/policies/ApiPoliciesCard";
import { EntityRolePoliciesCard } from "../../permissions/components/policies/EntityRolePoliciesCard";
import { RoleUsersCard } from "../../permissions/components/roles/RoleUsersCard";

export interface RoleContentProps {
  role: string | undefined;
}

export const RoleContent = (props: RoleContentProps) => {
  const { role } = props;
  if (!role) return <Alert severity="error">Role name is not provided</Alert>;
  return (
    <Box
      sx={{
        width: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <EntityRolePoliciesCard role={role} />
      <ApiPoliciesCard role={role} />
      <RoleUsersCard role={role} />
    </Box>
  );
};
