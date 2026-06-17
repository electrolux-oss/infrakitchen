import { useCallback, useEffect, useMemo, useState } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, useConfig } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import PageContainer from "../../common/PageContainer";
import { AUDIT_LOG_ACTIONS_QUERY, AUDIT_LOG_FIELD_MAP } from "../graphql";

export const AuditLogsPage = () => {
  const { ikApi } = useConfig();
  const [actions, setActions] = useState<string[]>([]);

  useEffect(() => {
    ikApi
      .graphqlRequest<{ auditLogActions: string[] }>(AUDIT_LOG_ACTIONS_QUERY)
      .then((response) => {
        setActions(response.auditLogActions || []);
      });
  }, [ikApi]);

  // Configure filters
  const filterConfigs: FilterConfig[] = useMemo(
    () => [
      {
        id: "action",
        type: "autocomplete" as const,
        label: "Action",
        options: actions,
        multiple: true,
        width: 420,
      },
    ],
    [actions],
  );

  // Build API filters
  const buildApiFilters = useCallback((filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.action && filterValues.action.length > 0) {
      apiFilters["action__in"] = filterValues.action;
    }

    return apiFilters;
  }, []);

  const columns = useMemo(
    () => [
      {
        field: "entityId",
        fetchFields: ["model", "entityId", "entityData"],
        headerName: "Entity",
        flex: 1,
        sortable: true,
        sortField: "entity_id",
        hideable: false,
        valueGetter: (value: string) => value,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <GetEntityLink
              id={params.row.entityId}
              _entity_name={params.row.model}
              name={params.row.entityData?.name ?? params.row.model}
            />
          );
        },
      },
      {
        field: "creator",
        headerName: "User",
        flex: 1,
        sortField: "creator.identifier",
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          if (creator?.id) {
            return (
              <GetEntityLink
                id={creator.id}
                _entity_name="user"
                name={creator.identifier}
              />
            );
          }
          return null;
        },
      },
      {
        field: "action",
        headerName: "Event",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => params.value,
      },
      {
        field: "model",
        headerName: "Model",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => params.value,
      },
      {
        field: "createdAt",
        headerName: "Time",
        flex: 1,
        sortField: "created_at",
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime
            date={params.value}
            sx={{ fontSize: "0.75rem", display: "flex" }}
          />
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer title="Audit Logs">
      <EntityFetchTable
        title="Audit Log"
        entityName="auditLog"
        columns={columns}
        entityFieldMap={AUDIT_LOG_FIELD_MAP}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
      />
    </PageContainer>
  );
};

AuditLogsPage.path = "/audit_logs";
