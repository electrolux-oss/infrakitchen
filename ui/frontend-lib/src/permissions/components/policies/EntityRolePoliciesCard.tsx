import { useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import { Button } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import {
  GetEntityLink,
  getDateValue,
  GetReferenceUrlValue,
} from "../../../common/components/CommonField";
import { EntityFetchTable } from "../../../common/components/EntityFetchTable";
import { PropertyCollapseCard } from "../../../common/components/PropertyCollapseCard";
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
        field: "resource_name",
        headerName: "Resource Name",
        flex: 1,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <GetEntityLink
              id={params.row.resource_id}
              _entity_name={"resource"}
              name={params.row.resource_name}
            />
          );
        },
      },
      {
        field: "action",
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
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
      {
        field: "creator",
        headerName: "Creator",
        sortable: false,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          return creator ? <GetReferenceUrlValue {...creator} /> : "No User";
        },
      },
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <DeletePermissionButton permission_id={params.value} />
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
      <Button
        variant="outlined"
        onClick={() => handleOpenDialog()}
        startIcon={<Icon icon="icon-park-outline:add" />}
      >
        Add Resource Policy
      </Button>
      <RolePolicyEntityCreateDialog
        role_name={role}
        open={isDialogOpen}
        onClose={handleCloseDialog}
      />
      <EntityFetchTable
        title="Role Policies"
        entityName={`resources/permissions/role/${role}/policie`}
        columns={columns}
        fields={["id"]}
      />
    </PropertyCollapseCard>
  );
};
