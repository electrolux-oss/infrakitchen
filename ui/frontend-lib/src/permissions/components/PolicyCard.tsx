import { useCallback, useEffect, useState } from "react";

import {
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { useConfig, GradientCircularProgress } from "../../common";
import { PermissionActionButton } from "../../common/components/buttons/PermissionActionButton";
import {
  GetReferenceUrlValue,
  getDateValue,
} from "../../common/components/CommonField";
import { notifyError } from "../../common/hooks/useNotification";
import { PermissionResponse } from "../types";

interface EntityPoliciesCardProps {
  entity_id: string | null;
  entity_name: string | null;
}

export const EntityPoliciesCard = (props: EntityPoliciesCardProps) => {
  const { entity_id, entity_name } = props;
  const { ikApi, linkPrefix } = useConfig();

  const [policies, setPolicies] = useState<PermissionResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const get_policy_list = useCallback(() => {
    if (!(entity_id && entity_name)) return;

    setLoading(true);
    ikApi
      .get(`permissions/${entity_name}/${entity_id}/policies`)
      .then((response) => {
        setPolicies(response);
        setLoading(false);
      })
      .catch((error) => {
        notifyError(error);
        setLoading(false);
      });
  }, [entity_id, entity_name, ikApi, setPolicies, setLoading]);

  useEffect(() => {
    if (!(entity_id && entity_name)) return;
    get_policy_list();
  }, [entity_id, entity_name, get_policy_list]);

  if (loading) return <GradientCircularProgress />;
  if (!policies) return null;

  return (
    <>
      {policies.length > 0 ? (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="policy table">
            <TableHead>
              <TableRow>
                <TableCell>User / Role</TableCell>
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
                    {role.v0.startsWith("user:") ? (
                      <Link
                        href={`${linkPrefix}users/${role.v0.split(":")[1]}`}
                      >
                        {role.v0.split(":")[1]}
                      </Link>
                    ) : (
                      <Link href={`${linkPrefix}roles/${role.v0}`}>
                        {role.v0}
                      </Link>
                    )}
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
      ) : (
        <Typography>
          No policies are currently assigned to this resource.
        </Typography>
      )}
    </>
  );
};
