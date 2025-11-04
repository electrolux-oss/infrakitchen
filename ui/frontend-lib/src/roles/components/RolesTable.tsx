import { Alert, Box, Card, CardContent, CardHeader, Link } from "@mui/material";

import { GradientCircularProgress, useConfig } from "../../common";

export const RoleTable = (props: { roles: string[]; loading?: boolean }) => {
  const { roles, loading } = props;
  const { linkPrefix } = useConfig();

  if (loading) return <GradientCircularProgress />;
  if (!roles) return <Alert severity="info">No roles available</Alert>;
  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      <Card sx={{ margin: 1 }}>
        {roles.length > 0 ? (
          <>
            <CardContent>
              {roles.map((role: any) => (
                <Box key={role} sx={{ marginBottom: 1 }}>
                  <Link href={`${linkPrefix}roles/${role}`}>{role}</Link>
                </Box>
              ))}
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader title="No Roles Assigned" />
            <CardContent>
              <p>No roles</p>
            </CardContent>
          </>
        )}
      </Card>
    </Box>
  );
};
