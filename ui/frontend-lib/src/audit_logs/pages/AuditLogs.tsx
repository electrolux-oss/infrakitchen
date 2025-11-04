import { useEffect, useMemo, useState } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import {
  getDateValue,
  GetEntityLink,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";

export const AuditLogsPage = () => {
  const { ikApi } = useConfig();
  const [filters, setFilters] = useState<string[]>([]);

  useEffect(() => {
    ikApi.get("audit_logs/actions").then((response) => {
      setFilters(response);
    });
  }, [ikApi]);

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
        filters={filters}
        filterName="action"
      />
    </PageContainer>
  );
};

AuditLogsPage.path = "/audit_logs";
