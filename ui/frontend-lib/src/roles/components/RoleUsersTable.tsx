import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Card,
  CardContent,
  CardHeader,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

import { GradientCircularProgress, useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import { UserShort } from "../../users";

export const RoleUsersTable = (props: { role: string }) => {
  const { role } = props;
  const { ikApi, linkPrefix } = useConfig();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserShort[]>([]);

  const get_users = useCallback(() => {
    if (!role) return;

    setLoading(true);
    ikApi
      .get(`permissions/role/${role}/users`)
      .then((response) => {
        setUsers(response);
        setLoading(false);
      })
      .catch((error) => {
        notifyError(error);
        setLoading(false);
      });
  }, [role, ikApi, setUsers, setLoading]);

  useEffect(() => {
    if (!role) return;
    setLoading(true);
    get_users();
  }, [role, get_users, setLoading]);

  if (loading) return <GradientCircularProgress />;
  if (!users) return <Alert severity="info">No users available</Alert>;
  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      <Card>
        <CardHeader title="User List" />
        {users.length > 0 ? (
          <CardContent>
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="users table">
                <TableHead>
                  <TableRow>
                    <TableCell>Identifier</TableCell>
                    <TableCell>Provider</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user: UserShort) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Link href={`${linkPrefix}users/${user.id}`}>
                          {user.identifier}
                        </Link>
                      </TableCell>
                      <TableCell>{user.provider}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        ) : (
          <CardContent>
            <p>No users</p>
          </CardContent>
        )}
      </Card>
    </Box>
  );
};
