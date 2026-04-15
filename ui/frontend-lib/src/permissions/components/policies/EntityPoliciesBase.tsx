import { useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import {
  GetEntityLink,
  capitalizeFirstLetter,
} from "../../../common/components/CommonField";
import { EntityFetchTable } from "../../../common/components/EntityFetchTable";
import { RelativeTime } from "../../../common/components/RelativeTime";
import { DeletePermissionButton } from "../PermissionActionButton";

import {
  EntityPolicyRoleCreateDialog,
  UserPolicyEntityCreateDialog,
} from "./EntityPoliciesDialogs";

interface EntityPoliciesBaseProps {
  entity_id: string;
  entity_name: string;
}

export const EntityPoliciesBase = ({
  entity_id,
  entity_name = "resource",
}: EntityPoliciesBaseProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);

  const columns = useMemo(
    () => [
      {
        field: "v1",
        fetchFields: ["v0", "v1"],
        headerName: "Role/User",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          if (params.row.v0.startsWith("user:")) {
            return (
              <GetEntityLink
                id={params.row.v0.split(":")[1]}
                _entity_name={"user"}
                name={params.row.v0.split(":")[1]}
              />
            );
          } else {
            return (
              <GetEntityLink
                id={params.row.v0}
                _entity_name={"role"}
                name={params.row.v0}
              />
            );
          }
        },
      },
      {
        field: "action",
        fetchFields: ["action", "v2"],
        headerName: "Action",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          if (params.row.action) {
            return params.row.action;
          } else {
            return params.row.v2;
          }
        },
      },
      {
        field: "created_at",
        headerName: "Created",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime
            date={params.value}
            sx={{ fontSize: "0.75rem", display: "flex" }}
          />
        ),
      },
      {
        field: "creator",
        headerName: "Creator",
        sortable: false,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          return creator ? <GetEntityLink {...creator} /> : "No User";
        },
      },
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <PermissionWrapper
            requiredPermission="api:permission"
            permissionAction="admin"
          >
            <DeletePermissionButton permission_id={params.value} />
          </PermissionWrapper>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PermissionWrapper
        requiredPermission={"api:permission"}
        permissionAction="write"
      >
        <Button
          variant="outlined"
          onClick={() => setIsDialogOpen(true)}
          startIcon={<Icon icon="icon-park-outline:add" />}
          sx={{ mr: 1 }}
        >
          Add Role
        </Button>
        <EntityPolicyRoleCreateDialog
          entity_id={entity_id}
          entity_name={entity_name}
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
        />
        <Button
          variant="outlined"
          onClick={() => setIsUserDialogOpen(true)}
          startIcon={<Icon icon="icon-park-outline:add" />}
        >
          Add User
        </Button>
        <UserPolicyEntityCreateDialog
          entity_id={entity_id}
          entity_name={entity_name}
          open={isUserDialogOpen}
          onClose={() => setIsUserDialogOpen(false)}
        />
      </PermissionWrapper>
      <EntityFetchTable
        title={`${capitalizeFirstLetter(entity_name)} Policies`}
        entityName={`permissions/${entity_name}/${entity_id}/policie`}
        columns={columns}
        fields={["id"]}
      />
    </>
  );
};
