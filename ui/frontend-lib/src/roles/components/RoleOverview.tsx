import { useCallback, useEffect, useState } from "react";

import { Icon } from "@iconify/react";
import {
  Button,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { useConfig, GradientCircularProgress } from "../../common";
import {
  GetReferenceUrlValue,
  getDateValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { notifyError } from "../../common/hooks/useNotification";
import { PermissionActionButton } from "../../permissions/components/PermissionActionButton";
import { RolePolicyCreateDialog } from "../../permissions/components/RolePolicyCreate";

export const RoleOverview = (props: { role: string }) => {
  const { role } = props;
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
    if (!role) return;

    setLoading(true);
    ikApi
      .get(`permissions/role/${role}/policies`)
      .then((response) => {
        setPolicies(response);
        setLoading(false);
      })
      .catch((error) => {
        notifyError(error);
        setLoading(false);
      });
  }, [role, ikApi, setPolicies, setLoading]);

  useEffect(() => {
    if (!role) return;
    setLoading(true);
    get_policy_list();
  }, [role, get_policy_list, setLoading]);

  if (loading) return <GradientCircularProgress />;
  if (!policies) return null;

  return (
    <OverviewCard
      name="Policy list"
      actions={
        <>
          <Button
            variant="outlined"
            onClick={() => handleOpenDialog()}
            startIcon={<Icon icon="icon-park-outline:add" />}
          >
            Assign Policy
          </Button>
          <RolePolicyCreateDialog
            role_name={role}
            open={isDialogOpen}
            onClose={handleCloseDialog}
          />
        </>
      }
    >
      {policies.length > 0 ? (
        <TableContainer>
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
      ) : (
        <Typography>No policies assigned to this role.</Typography>
      )}
    </OverviewCard>
  );
};
