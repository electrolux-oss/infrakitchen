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
import { PermissionResponse } from "../types";

import { PermissionActionButton } from "./PermissionActionButton";
import { UserPolicyCreateDialog } from "./UserPolicyCreateDialog";

export const UserPoliciesCard = (props: { user_id: string }) => {
  const { user_id } = props;
  const { ikApi, linkPrefix } = useConfig();

  const [policies, setPolicies] = useState<PermissionResponse[]>([]);
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
      .get(`permissions/user/${user_id}/policies`)
      .then((response) => {
        setPolicies(response);
        setLoading(false);
      })
      .catch((error) => {
        notifyError(error);
        setLoading(false);
      });
  }, [user_id, ikApi, setPolicies, setLoading]);

  useEffect(() => {
    if (!user_id) return;
    get_policy_list();
  }, [user_id, get_policy_list]);

  if (loading) return <GradientCircularProgress />;
  if (!policies) return null;

  return (
    <Box sx={{ width: "100%", typography: "body1" }}>
      <Card>
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
              <UserPolicyCreateDialog
                user_id={user_id}
                open={isDialogOpen}
                onClose={handleCloseDialog}
              />
            </>
          }
        />

        {policies.length > 0 ? (
          <CardContent>
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="policy table">
                <TableHead>
                  <TableRow>
                    <TableCell>Resource</TableCell>
                    <TableCell>Access</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Creator</TableCell>
                    <TableCell>Delete</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {policies.map((role: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Link
                          href={`${linkPrefix}resources/${role.v1.split(":")[1]}`}
                        >
                          {role.v1}
                        </Link>
                      </TableCell>
                      <TableCell>{role.v2}</TableCell>
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
        ) : (
          <CardContent>
            <p>No policies are currently assigned to this user.</p>
          </CardContent>
        )}
      </Card>
    </Box>
  );
};
