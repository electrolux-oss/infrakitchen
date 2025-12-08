import { useCallback, useEffect, useState } from "react";

import { Icon } from "@iconify/react";
import {
  Box,
  Button,
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

import { getDateValue } from "../../common/components/CommonField";
import { useConfig } from "../../common/context/ConfigContext";
import GradientCircularProgress from "../../common/GradientCircularProgress";
import { notifyError } from "../../common/hooks/useNotification";

import { PermissionActionButton } from "./PermissionActionButton";
import { UserRoleCreateDialog } from "./UserRoleCreateDialog";

interface UserRolesCardProps {
  user_id: string;
}

export const UserRolesCard = (props: UserRolesCardProps) => {
  const { user_id } = props;
  const { ikApi, linkPrefix } = useConfig();

  const [roles, setRoles] = useState<object[]>([]);
  const [loading, setLoading] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    get_policy_list();
  };

  const get_policy_list = useCallback(() => {
    if (!user_id) return;

    ikApi
      .get(`permissions/user/${user_id}/roles`)
      .then((response) => {
        setRoles(response);
        setLoading(false);
      })
      .catch((error) => {
        notifyError(error);
        setLoading(false);
      });
  }, [user_id, ikApi, setRoles, setLoading]);

  useEffect(() => {
    if (!user_id) return;
    setLoading(true);
    get_policy_list();
  }, [user_id, get_policy_list, setLoading]);

  if (loading) return <GradientCircularProgress />;
  if (!roles) return null;

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      <Card>
        <CardHeader
          title="Role List"
          action={
            <>
              <Button
                variant="outlined"
                onClick={() => handleOpenDialog()}
                startIcon={<Icon icon="icon-park-outline:add" />}
              >
                Assign Role
              </Button>
              <UserRoleCreateDialog
                user_id={user_id}
                open={isDialogOpen}
                onClose={handleCloseDialog}
              />
            </>
          }
        />

        {roles.length > 0 ? (
          <CardContent>
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="roles table">
                <TableHead>
                  <TableRow>
                    <TableCell>Role</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Creator</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roles.map((role: any) => (
                    <TableRow key={role.id}>
                      <TableCell>
                        <Link href={`${linkPrefix}roles/${role.v1}`}>
                          {role.v1}
                        </Link>
                      </TableCell>
                      <TableCell>{getDateValue(role.created_at)}</TableCell>
                      <TableCell>
                        {role.creator ? (
                          <Link href={`${linkPrefix}users/${role.creator.id}`}>
                            {role.creator.identifier}
                          </Link>
                        ) : (
                          "No User"
                        )}
                      </TableCell>
                      <TableCell>
                        <PermissionActionButton
                          permission_id={role.id}
                          onDelete={() => get_policy_list()}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        ) : (
          <CardContent>
            <p>No roles assigned to this user.</p>
          </CardContent>
        )}
      </Card>
    </Box>
  );
};
