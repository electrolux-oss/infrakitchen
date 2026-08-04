import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Control,
  Controller,
  FieldErrors,
  UseFormSetValue,
  useWatch,
} from "react-hook-form";

import { Box, FormControl, FormHelperText, InputLabel } from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridPaginationModel,
  GridRenderCellParams,
  GridRowSelectionModel,
  GridSortModel,
} from "@mui/x-data-grid";

import { GetEntityLink } from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterProvider } from "../../common/components/filter_panel/FilterContext";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { useLocalStorage } from "../../common/context/UIStateContext";
import { buildGraphqlFields } from "../../common/graphql/buildGraphqlFields";
import { notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { executorColumns as filterableExecutorColumns } from "../../executors/components/executorTableConfig";
import { EXECUTOR_FIELD_MAP } from "../../executors/graphql";
import { resourceColumns as filterableResourceColumns } from "../../resources/components/resourceTableConfig";
import { RESOURCE_FIELD_MAP } from "../../resources/graphql";
import { IkEntity } from "../../types";
import { BatchOperationCreate } from "../types";

export interface BatchOperationEntitySelectorProps {
  control: Control<BatchOperationCreate>;
  errors: FieldErrors<BatchOperationCreate>;
  entityType: "resource" | "executor";
  setValue: UseFormSetValue<BatchOperationCreate>;
}

export const BatchOperationEntitySelector = (
  props: BatchOperationEntitySelectorProps,
) => {
  const { control, errors, entityType, setValue } = props;
  const { ikApi } = useConfig();
  const { get: getStoredValue } = useLocalStorage();

  const selectedEntityIds = useWatch({
    control,
    name: "entityIds",
  }) as Array<string | number> | undefined;

  const [filterValues, setFilterValues] = useState<Record<string, any>>(() => {
    const stored = getStoredValue(`filter_batch_operation_${entityType}`);
    return stored && Object.keys(stored).length > 0 ? stored : {};
  });
  const [entities, setEntities] = useState<IkEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);

  const resourceSelectionColumns: GridColDef[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        fetchFields: ["name", "id", "entityName"],
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "template",
        headerName: "Template",
        flex: 1,
        valueGetter: (value: any) => value?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const template = params.row.template;
          return <GetEntityLink {...template} />;
        },
      },
      {
        field: "sourceCodeVersion",
        headerName: "Source Code Version",
        flex: 1,
        valueGetter: (value: any, row: any) =>
          row.sourceCodeVersion?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const sourceCodeVersion = params.row.sourceCodeVersion;
          return <GetEntityLink {...sourceCodeVersion} />;
        },
      },
      {
        field: "state",
        headerName: "State",
        flex: 1,
        valueGetter: (_value: any, row: any) => `${row.state}-${row.status}`,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip
            status={String(params.row.status).toLowerCase()}
            state={String(params.row.state).toLowerCase()}
          />
        ),
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
    ],
    [],
  );

  const executorSelectionColumns: GridColDef[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        fetchFields: ["name", "id", "entityName"],
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "sourceCode",
        headerName: "Source Code",
        flex: 1,
        valueGetter: (value: any, row: any) => row.sourceCode?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const sourceCodeVersion = params.row.sourceCode;
          return <GetEntityLink {...sourceCodeVersion} />;
        },
      },
      {
        field: "state",
        headerName: "State",
        flex: 1,
        valueGetter: (_value: any, row: any) => `${row.state}-${row.status}`,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip
            status={String(params.row.status).toLowerCase()}
            state={String(params.row.state).toLowerCase()}
          />
        ),
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
    ],
    [],
  );

  const columns = useMemo(
    () =>
      entityType === "resource"
        ? resourceSelectionColumns
        : executorSelectionColumns,
    [entityType, resourceSelectionColumns, executorSelectionColumns],
  );

  const filterColumns = useMemo<EntityTableColumn[]>(
    () =>
      entityType === "resource"
        ? filterableResourceColumns
        : filterableExecutorColumns,
    [entityType],
  );

  const handleFilterChange = useCallback((values: Record<string, any>) => {
    setFilterValues(values);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  const buildRowSelectionModel = useCallback(
    (selectedIds: Array<string | number>): GridRowSelectionModel => ({
      type: "include",
      ids: new Set(selectedIds),
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchEntities = async () => {
      setLoading(true);
      const entityName = entityType === "resource" ? "resource" : "executor";
      const fieldMap =
        entityType === "resource" ? RESOURCE_FIELD_MAP : EXECUTOR_FIELD_MAP;

      const sort =
        sortModel.length === 0
          ? { field: "created_at", sort: "desc" }
          : sortModel[0];
      const apiSort = sort
        ? {
            field: sort.field,
            order: sort.sort?.toUpperCase() as "ASC" | "DESC",
          }
        : { field: "created_at", order: "DESC" as "ASC" | "DESC" };

      const fields =
        entityType === "resource"
          ? [
              "id",
              "name",
              "template",
              "sourceCodeVersion",
              "state",
              "status",
              "createdAt",
              "labels",
              "entityName",
            ]
          : [
              "id",
              "name",
              "sourceCode",
              "state",
              "status",
              "createdAt",
              "labels",
              "entityName",
            ];

      try {
        const response = await ikApi.graphqlRequest<Record<string, any>>(
          `
            query BatchOperationSelectorEntities($filter: JSON, $sort: [String!], $range: [Int!]) {
              ${entityName}s(filter: $filter, sort: $sort, range: $range) {
                ${buildGraphqlFields(fields, fieldMap)}
              }
              ${entityName}sCount(filter: $filter)
            }
          `,
          {
            filter: buildAdvancedApiFilters(filterValues),
            sort: [apiSort.field, apiSort.order],
            range: [
              paginationModel.page * paginationModel.pageSize,
              (paginationModel.page + 1) * paginationModel.pageSize,
            ],
          },
        );
        if (!cancelled) {
          const rows = response[`${entityName}s`] || [];

          setEntities(rows);
          setTotalRows(response[`${entityName}sCount`] || 0);
        }
      } catch (e) {
        if (!cancelled) notifyError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEntities();

    return () => {
      cancelled = true;
    };
  }, [
    ikApi,
    entityType,
    paginationModel.page,
    paginationModel.pageSize,
    sortModel,
    filterValues,
  ]);

  return (
    <Controller
      name="entityIds"
      control={control}
      rules={{
        required: "At least one entity must be selected",
        validate: (value) =>
          value.length > 0 || "At least one entity must be selected",
      }}
      render={({ field }) => (
        <FormControl fullWidth margin="normal" error={!!errors.entityIds}>
          <InputLabel shrink>
            {`Select ${entityType === "resource" ? "Resources" : "Executors"}`}
          </InputLabel>
          <Box sx={{ mt: 1 }}>
            <FilterProvider
              columns={filterColumns}
              storageKey={`filter_batch_operation_${entityType}`}
              onFilterChange={handleFilterChange}
            >
              <FilterPanel />
            </FilterProvider>
            <Box sx={{ mt: 2, height: 520, width: "100%" }}>
              <DataGrid
                rows={entities}
                columns={columns}
                loading={loading}
                rowCount={totalRows}
                paginationMode="server"
                sortingMode="server"
                checkboxSelection
                disableRowSelectionOnClick
                rowSelectionModel={buildRowSelectionModel(
                  Array.isArray(selectedEntityIds) ? selectedEntityIds : [],
                )}
                onRowSelectionModelChange={(newSelection) => {
                  const currentPageIds = entities.map((entity) =>
                    String(entity.id),
                  );
                  const excludedIds = new Set(
                    Array.from(newSelection.ids).map(String),
                  );
                  const baseSelected = Array.isArray(selectedEntityIds)
                    ? selectedEntityIds.map(String)
                    : [];

                  const nextSelected =
                    newSelection.type === "exclude"
                      ? Array.from(
                          new Set([
                            ...baseSelected,
                            ...currentPageIds.filter(
                              (id) => !excludedIds.has(id),
                            ),
                          ]),
                        )
                      : Array.from(excludedIds);

                  setValue("entityIds", nextSelected, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  field.onChange(nextSelected);
                }}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                sortModel={sortModel}
                onSortModelChange={setSortModel}
                pageSizeOptions={[10, 25, 50, 100]}
                keepNonExistentRowsSelected
                sx={{
                  "& .MuiDataGrid-columnHeader": {
                    "& .MuiDataGrid-columnHeaderTitleContainer": {
                      justifyContent: "space-between",
                      flexDirection: "row",
                    },
                  },
                }}
                slotProps={{
                  pagination: {
                    SelectProps: {
                      inputProps: {
                        "aria-label": "Rows per page",
                        "aria-labelledby": "entity-pagination-label",
                      },
                      "aria-label": "Rows per page",
                    },
                    labelRowsPerPage: "Rows per page:",
                    labelId: "entity-pagination-label",
                  },
                }}
              />
            </Box>
          </Box>
          <FormHelperText>
            {errors.entityIds
              ? errors.entityIds.message
              : `Select ${entityType}s to include in this batch operation`}
          </FormHelperText>
        </FormControl>
      )}
    />
  );
};
