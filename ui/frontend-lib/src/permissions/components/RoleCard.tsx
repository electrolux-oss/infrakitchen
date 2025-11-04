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

import {
  GetReferenceUrlValue,
  getDateValue,
} from "../../common/components/CommonField";
import { useConfig } from "../../common/context/ConfigContext";
import GradientCircularProgress from "../../common/GradientCircularProgress";
import { notifyError } from "../../common/hooks/useNotification";

import { PermissionActionButton } from "./PermissionActionButton";
import { RolePolicyCreateDialog } from "./RolePolicyCreate";

export const RoleCard = (props: { role_name: string }) => {
  const { role_name } = props;
  const { ikApi, linkPrefix } = useConfig();

  const [policies, setPolicies] = useState<object[]>([]);
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
    if (!role_name) return;

    setLoading(true);
    ikApi
      .get(`permissions/role/${role_name}/policies`)
      .then((response) => {
        setPolicies(response);
        setLoading(false);
      })
      .catch((error) => {
        notifyError(error);
        setLoading(false);
      });
  }, [role_name, ikApi, setPolicies, setLoading]);

  useEffect(() => {
    if (!role_name) return;
    setLoading(true);
    get_policy_list();
  }, [role_name, get_policy_list, setLoading]);

  if (loading) return <GradientCircularProgress />;
  if (!policies) return null;

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      <Card sx={{ margin: 1 }}>
        <CardHeader
          title="Policy List"
          action={
            <>
              <Button
                variant="outlined"
                onClick={() => handleOpenDialog()}
                startIcon={<Icon icon="icon-park-outline:add" />}
              >
                Assign Policy
              </Button>
              <RolePolicyCreateDialog
                role_name={role_name}
                open={isDialogOpen}
                onClose={handleCloseDialog}
              />
            </>
          }
        />
        {policies.length > 0 ? (
          <>
            <CardContent>
              <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="roles table">
                  <TableHead>
                    <TableRow>
                      <TableCell>Object</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Creator</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {policies.map((role: any) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <Link href={`${linkPrefix}permissions/${role.id}`}>
                            {role.v1}
                          </Link>
                        </TableCell>
                        <TableCell>{role.v2 ? role.v2 : "No Action"}</TableCell>
                        <TableCell>{getDateValue(role.created_at)}</TableCell>
                        <TableCell>
                          {role.creator ? (
                            <GetReferenceUrlValue {...role.creator} />
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
          </>
        ) : (
          <>
            <CardContent>
              <p>No policies assigned to this role.</p>
            </CardContent>
          </>
        )}
      </Card>
    </Box>
  );
};
