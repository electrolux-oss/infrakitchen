import { useCallback, useMemo, useRef, useState } from "react";

import { useNavigate } from "react-router";

import { PermissionWrapper } from "../../../common";
import { Entity } from "../../../common/components/entities/Entity";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../../common/components/entity_table/EntityFetchTable";
import {
  RELATIVE_TIME_COLUMN_WIDTH,
  userColumn,
} from "../../../common/components/entity_table/tableColumns";
import { capitalizeFirstLetter } from "../../../common/components/fields/CommonField";
import { RelativeTime } from "../../../common/components/fields/RelativeTime";
import { useConfig } from "../../../common/context";
import { AdminPanelSettingsIcon, PersonAddIcon } from "../../../icons/material";
import { Button, Chip } from "../../../ui";
import { RenderCellParams } from "../../../ui";
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
        renderCell: (params: RenderCellParams) => {
          if (params.row.v0.startsWith("user:")) {
            return (
              <Entity
                entity={{
                  ...params.row.userData,
                  id: params.row.v0.split(":")[1],
                  entityType: "user",
                }}
              />
            );
          } else {
            return (
              <Entity
                entity={{
                  id: params.row.v0,
                  entityType: "role",
                  name: params.row.v0,
                }}
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
        renderCell: (params: RenderCellParams) => {
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
              renderCell: (params: RenderCellParams) => {
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
        width: RELATIVE_TIME_COLUMN_WIDTH,
        renderCell: (params: RenderCellParams) => (
          <RelativeTime
            className="flex justify-end"
            date={params.value}
            compact
          />
        ),
      },
      userColumn({ disableFilter: true, sortable: false, sortField: null }),
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
        flex: 1,
        renderCell: (params: RenderCellParams) =>
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
        <div className="mb-1 flex w-full justify-end gap-2">
          <Button
            size="small"
            onClick={() => setIsDialogOpen(true)}
            startIcon={<AdminPanelSettingsIcon />}
          >
            Add Role
          </Button>
          <Button
            size="small"
            onClick={() => setIsUserDialogOpen(true)}
            startIcon={<PersonAddIcon />}
          >
            Add User
          </Button>
        </div>
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
      <EntityPolicyRoleCreateDialog
        entityId={entityId}
        entityName={entityName}
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={refreshPoliciesTable}
      />
      <UserPolicyEntityCreateDialog
        entityId={entityId}
        entityName={entityName}
        open={isUserDialogOpen}
        onClose={() => setIsUserDialogOpen(false)}
        onSuccess={refreshPoliciesTable}
      />
    </>
  );
};
