import { useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import { GetEntityLink } from "../../../common/components/CommonField";
import { EntityFetchTable } from "../../../common/components/EntityFetchTable";
import { PropertyCollapseCard } from "../../../common/components/PropertyCollapseCard";
import { RelativeTime } from "../../../common/components/RelativeTime";
import { PERMISSION_FIELD_MAP } from "../../graphql";
import { DeletePermissionButton } from "../PermissionActionButton";

import { RolePolicyEntityCreateDialog } from "./EntityPoliciesDialogs";

export const EntityRolePoliciesCard = (props: { role: string }) => {
  const { role } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleOpenDialog = () => {
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const columns = useMemo(
    () => [
      {
        field: "entityData",
        fetchFields: ["entityData", "v1", "entityName"],
        headerName: "Entity Name",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          if (params.row.v1 && params.row.v1.includes("*")) {
            return <span>{params.row.v1}</span>;
          }
          return <GetEntityLink {...params.row.entityData} />;
        },
      },
      {
        field: "action",
        fetchFields: ["v2"],
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
        field: "createdAt",
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
        flex: 1,
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          if (!creator) return null;
          return <GetEntityLink {...creator} />;
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
    <PropertyCollapseCard
      title={"Role Resource Policy List"}
      expanded={true}
      id="role-resource-policies-card"
    >
      <PermissionWrapper
        requiredPermission="api:permission"
        permissionAction="write"
      >
        <Button
          variant="outlined"
          onClick={() => handleOpenDialog()}
          startIcon={<Icon icon="icon-park-outline:add" />}
        >
          Add Resource Policy
        </Button>
        <RolePolicyEntityCreateDialog
          roleName={role}
          open={isDialogOpen}
          onClose={handleCloseDialog}
        />
      </PermissionWrapper>
      <EntityFetchTable
        title="Role Policies"
        entityName="permission"
        defaultFilter={{ v0: role, ptype: "p", v1__not_like: "api:%" }}
        columns={columns}
        entityFieldMap={PERMISSION_FIELD_MAP}
      />
    </PropertyCollapseCard>
  );
};
