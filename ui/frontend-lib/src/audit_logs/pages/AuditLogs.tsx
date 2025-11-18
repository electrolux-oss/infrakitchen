import { useEffect, useMemo, useState } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig, FilterConfig } from "../../common";
import {
  getDateValue,
  GetEntityLink,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";

export const AuditLogsPage = () => {
  const { ikApi } = useConfig();
  const [actions, setActions] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("audit_logs/actions").then((response) => {
      setActions(response);
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
  const buildApiFilters = (filterValues: Record<string, any>) => {
    const apiFilters: Record<string, any> = {};

    if (filterValues.action && filterValues.action.length > 0) {
      apiFilters["action__in"] = filterValues.action;
    }

    return apiFilters;
  };

  const columns = useMemo(
    () => [
      {
        field: "created_at",
        headerName: "Time",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
      {
        field: "user_id",
        headerName: "User",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          return GetReferenceUrlValue(params.row.creator);
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
        headerName: "Entity",
        flex: 1,
        sortable: true,
        valueGetter: (value: string) => value,
        renderCell: (params: GridRenderCellParams) => {
          return GetEntityLink({
            id: params.row.entity_id,
            _entity_name: params.row.model,
            name: params.row.model,
          });
        },
      },
    ],
    [],
  );

  return (
    <PageContainer title="Audit Logs">
      <EntityFetchTable
        title="Audit Log"
        entityName="audit_log"
        columns={columns}
        fields={["id", "user_id", "action", "model", "entity_id", "created_at"]}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
      />
    </PageContainer>
  );
};

AuditLogsPage.path = "/audit_logs";
