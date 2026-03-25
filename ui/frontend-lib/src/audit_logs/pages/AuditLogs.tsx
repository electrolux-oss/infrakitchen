import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GridRenderCellParams } from "@mui/x-data-grid";

import { FilterConfig, useConfig } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import {
  useEntityMetadataFromRows,
  EntityMeta,
} from "../../common/hooks/useEntityMetadata";
import PageContainer from "../../common/PageContainer";
import { IkEntity } from "../../types";

export const AuditLogsPage = () => {
  const { ikApi } = useConfig();
  const [actions, setActions] = useState<string[]>([]);
  const [rows, setRows] = useState<IkEntity[]>([]);

  const { data: entityMeta } = useEntityMetadataFromRows(rows);

  const entityMetaRef = useRef<Map<string, EntityMeta>>(entityMeta);
  entityMetaRef.current = entityMeta;

  useEffect(() => {
    ikApi.get("audit_logs/actions").then((response) => {
      setActions(response);
    });
  }, [ikApi]);

  const onDataLoaded = useCallback((data: IkEntity[]) => {
    setRows(data);
  }, []);

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
        field: "creator",
        headerName: "User",
        flex: 1,
        valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const creator = params.row.creator;
          if (creator?.id) {
            return (
              <GetEntityLink
                id={creator.id}
                _entity_name="user"
                name={creator.display_name || creator.identifier}
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
        fetchFields: ["model", "entity_id"],
        headerName: "Entity",
        flex: 1,
        sortable: true,
        hideable: false,
        valueGetter: (value: string) => value,
        renderCell: (params: GridRenderCellParams) => {
          const meta = entityMetaRef.current.get(params.row.entity_id);
          return (
            <GetEntityLink
              id={params.row.entity_id}
              _entity_name={params.row.model}
              name={meta?.name ?? params.row.model}
            />
          );
        },
      },
      {
        field: "created_at",
        headerName: "Time",
        flex: 1,
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
        entityName="audit_log"
        columns={columns}
        onDataLoaded={onDataLoaded}
        fields={[
          "id",
          "user_id",
          "action",
          "model",
          "entity_id",
          "created_at",
          "creator",
        ]}
        filterConfigs={filterConfigs}
        buildApiFilters={buildApiFilters}
      />
    </PageContainer>
  );
};

AuditLogsPage.path = "/audit_logs";
