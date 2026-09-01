import { useCallback, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router";

import { Icon } from "@iconify/react";
import { Button, Chip } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { PermissionWrapper } from "../../../common";
import {
  GetEntityLink,
  capitalizeFirstLetter,
} from "../../../common/components/CommonField";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../../common/components/entity_table/EntityFetchTable";
import { RelativeTime } from "../../../common/components/RelativeTime";
import { useConfig } from "../../../common/context";
import { PERMISSION_FIELD_MAP } from "../../graphql";
import { DeletePermissionButton } from "../PermissionActionButton";

import {
  EntityPolicyRoleCreateDialog,
  UserPolicyEntityCreateDialog,
} from "./EntityPoliciesDialogs";

interface EntityPoliciesBaseProps {
  entityId: string;
  entityName: string;
  inheritedEntityIds?: string[];
}

export const EntityPoliciesBase = ({
  entityId,
  entityName = "resource",
  inheritedEntityIds,
}: EntityPoliciesBaseProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const tableRef = useRef<EntityFetchTableRef>(null);
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();
  const originalEntityId = `${entityName}:${entityId}`;
  const mergedEntityIds = inheritedEntityIds?.length
    ? [originalEntityId, ...inheritedEntityIds]
    : undefined;

  const refreshPoliciesTable = useCallback(() => {
    void tableRef.current?.refresh();
  }, []);

  const columns = useMemo(
    () => [
      {
        field: "v1",
        fetchFields: ["v0", "v1", "entityName", "userData"],
        headerName: "Role/User",
        flex: 1,
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          if (params.row.v0.startsWith("user:")) {
            return (
              <GetEntityLink
                id={params.row.v0.split(":")[1]}
                {...params.row.userData}
              />
            );
          } else {
            return (
              <GetEntityLink
                id={params.row.v0}
                entityName={"role"}
                name={params.row.v0}
              />
            );
          }
        },
      },
      {
        field: "action",
        fetchFields: ["v1", "v2"],
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
      ...(inheritedEntityIds?.length
        ? [
            {
              field: "policySource",
              fetchFields: ["v1"],
              headerName: "Source",
              sortable: false,
              flex: 1,
              renderCell: (params: GridRenderCellParams) => {
                const isInherited = params.row.v1 !== originalEntityId;
                const inheritedProjectId = params.row.v1.split(":")[1];
                const projectPoliciesPath = `${linkPrefix}projects/${inheritedProjectId}/policies`;

                return isInherited ? (
                  <Chip
                    label="Inherited from Project"
                    color="info"
                    variant="outlined"
                    component="a"
                    href={projectPoliciesPath}
                    clickable
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey) {
                        return;
                      }

                      event.preventDefault();
                      navigate(projectPoliciesPath);
                    }}
                  />
                ) : (
                  <Chip label="Direct" variant="outlined" />
                );
              },
            },
          ]
        : []),
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
        renderCell: (params: GridRenderCellParams) =>
          params.row.v1 === originalEntityId ? (
            <PermissionWrapper
              requiredPermission="api:permission"
              permissionAction="admin"
            >
              <DeletePermissionButton
                permission_id={params.value}
                onDelete={refreshPoliciesTable}
                enableCascadeDelete={entityName === "resource"}
              />
            </PermissionWrapper>
          ) : null,
      },
    ],
    [
      refreshPoliciesTable,
      entityName,
      inheritedEntityIds,
      linkPrefix,
      navigate,
      originalEntityId,
    ],
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
          entityId={entityId}
          entityName={entityName}
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSuccess={refreshPoliciesTable}
        />
        <Button
          variant="outlined"
          onClick={() => setIsUserDialogOpen(true)}
          startIcon={<Icon icon="icon-park-outline:add" />}
        >
          Add User
        </Button>
        <UserPolicyEntityCreateDialog
          entityId={entityId}
          entityName={entityName}
          open={isUserDialogOpen}
          onClose={() => setIsUserDialogOpen(false)}
          onSuccess={refreshPoliciesTable}
        />
      </PermissionWrapper>
      <EntityFetchTable
        ref={tableRef}
        title={`${capitalizeFirstLetter(entityName)} Policies`}
        entityName="permission"
        defaultFilter={
          mergedEntityIds
            ? { ptype: "p", v1__in: mergedEntityIds }
            : { ptype: "p", v1: originalEntityId }
        }
        columns={columns}
        entityFieldMap={PERMISSION_FIELD_MAP}
      />
    </>
  );
};
