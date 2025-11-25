import { Alert, Box } from "@mui/material";

import { RoleOverview } from "./RoleOverview";
import { RoleUsersTable } from "./RoleUsersTable";

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
      <RoleOverview role={role} />
      <RoleUsersTable role={role} />
    </Box>
  );
};
