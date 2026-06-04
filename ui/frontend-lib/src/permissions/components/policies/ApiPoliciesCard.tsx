import { useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import { GetEntityLink } from "../../../common/components/CommonField";
import { EntityFetchTable } from "../../../common/components/EntityFetchTable";
import { PropertyCollapseCard } from "../../../common/components/PropertyCollapseCard";
import { RelativeTime } from "../../../common/components/RelativeTime";
import { PERMISSION_FIELD_MAP, transformPermission } from "../../graphql";
import { DeletePermissionButton } from "../PermissionActionButton";

import { PolicyApiCreateDialog } from "./PolicyApiCreateDialog";

export const ApiPoliciesCard = (props: { role: string }) => {
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
        field: "entity_data",
        fetchFields: ["entity_data", "v1"],
        headerName: "Entity Name",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          if (!params.row.entity_data) {
            // API type policy
            return params.row.v1;
          }
          return (
            <GetEntityLink
              id={params.row.entity_data?.id}
              _entity_name={params.row.entity_data?._entity_name}
              name={params.row.entity_data?.name}
            />
          );
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
        flex: 1,
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          if (!creator) return null;
          return (
            <GetEntityLink
              {...creator}
              name={creator.identifier}
              _entity_name="user"
            />
          );
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
      title={"Role Api Policy List"}
      expanded={true}
      id="role-api-policies"
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
          Add Api Policy
        </Button>
        <PolicyApiCreateDialog
          role_name={role}
          open={isDialogOpen}
          onClose={handleCloseDialog}
        />
      </PermissionWrapper>
      <EntityFetchTable
        title="Api Policies"
        entityName="permission"
        defaultFilter={{ v0: role, ptype: "p", v1__like: "api:%" }}
        columns={columns}
        entityFieldMap={PERMISSION_FIELD_MAP}
        transformFn={transformPermission}
      />
    </PropertyCollapseCard>
  );
};
