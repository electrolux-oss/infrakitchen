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

import {
  getDateValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { FilterConfig } from "../../common/components/filter_panel/FilterConfig";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
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

  const selectedEntityIds = useWatch({
    control,
    name: "entity_ids",
  }) as Array<string | number> | undefined;

  const [labels, setLabels] = useState<string[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [entities, setEntities] = useState<IkEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 10,
  });
  const [sortModel, setSortModel] = useState<GridSortModel>([]);

  useEffect(() => {
    if (entityType === "resource") {
      ikApi.get("labels/resource").then((response: string[]) => {
        setLabels(response);
      });

      ikApi
        .getList("templates", {
          pagination: { page: 1, perPage: 1000 },
          fields: ["id", "name"],
          sort: { field: "name", order: "ASC" },
        })
        .then((response: any) => {
          const templateNames = response.data.map((t: any) => t.name);
          setTemplates(templateNames);
        })
        .catch(() => {
          setTemplates([]);
        });
    }

    if (entityType === "executor") {
      ikApi.get("labels/executor").then((response: string[]) => {
        setLabels(response);
      });
    }
  }, [ikApi, entityType]);

  useEffect(() => {
    setValue("entity_ids", [], { shouldValidate: true });
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    setSortModel([]);
  }, [entityType, setValue]);

  const resourceColumns: GridColDef[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "template_id",
        headerName: "Template",
        flex: 1,
        valueGetter: (value: any) => value?.name || "",
        renderCell: (params: GridRenderCellParams) => {
          const template = params.row.template;
          return <GetEntityLink {...template} />;
        },
      },
      {
        field: "source_code_version_id",
        headerName: "Source Code Version",
        flex: 1,
        valueGetter: (value: any, row: any) =>
          row.source_code_version?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const sourceCodeVersion = params.row.source_code_version;
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
        field: "created_at",
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
    ],
    [],
  );

  const executorColumns: GridColDef[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "source_code_id",
        headerName: "Source Code",
        flex: 1,
        valueGetter: (value: any, row: any) =>
          row.source_code_version?.identifier || "",
        renderCell: (params: GridRenderCellParams) => {
          const sourceCodeVersion = params.row.source_code;
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
        field: "created_at",
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
    ],
    [],
  );

  const columns = useMemo(
    () => (entityType === "resource" ? resourceColumns : executorColumns),
    [entityType, resourceColumns, executorColumns],
  );

  const filterConfigs: FilterConfig[] = useMemo(
    () =>
      entityType === "resource"
        ? [
            {
              id: "name",
              type: "search" as const,
              label: "Search",
              width: 420,
            },
            {
              id: "template",
              type: "autocomplete" as const,
              label: "Template",
              options: templates,
              multiple: true,
              width: 420,
            },
            {
              id: "labels",
              type: "autocomplete" as const,
              label: "Labels",
              options: labels,
              multiple: true,
              width: 420,
            },
          ]
        : [
            {
              id: "name",
              type: "search" as const,
              label: "Search",
              width: 420,
            },
            {
              id: "labels",
              type: "autocomplete" as const,
              label: "Labels",
              options: labels,
              multiple: true,
              width: 420,
            },
          ],
    [entityType, labels, templates],
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

  const buildApiFilters = useCallback(
    (values: Record<string, any>) => {
      const apiFilters: Record<string, any> = {};

      if (values.name && values.name.trim().length > 0) {
        apiFilters["name__like"] = values.name;
      }

      if (values.labels && values.labels.length > 0) {
        apiFilters["labels__contains_all"] = values.labels;
      }

      if (entityType === "resource") {
        if (values.template && values.template.length > 0) {
          apiFilters["template__name__in"] = values.template;
        }
      }

      return apiFilters;
    },
    [entityType],
  );

  useEffect(() => {
    const fetchEntities = async () => {
      setLoading(true);

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
              "source_code_version",
              "state",
              "status",
              "created_at",
              "labels",
            ]
          : [
              "id",
              "name",
              "source_code",
              "state",
              "status",
              "created_at",
              "labels",
            ];

      try {
        const response = await ikApi.getList(`${entityType}s`, {
          filter: buildApiFilters(filterValues),
          pagination: {
            page: paginationModel.page + 1,
            perPage: paginationModel.pageSize,
          },
          sort: apiSort,
          fields,
        });
        setEntities(response.data || []);
        setTotalRows(response.total ? response.total : 0);
      } catch (e) {
        notifyError(e);
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, [
    ikApi,
    entityType,
    paginationModel.page,
    paginationModel.pageSize,
    sortModel,
    filterValues,
    buildApiFilters,
  ]);

  return (
    <Controller
      name="entity_ids"
      control={control}
      rules={{
        required: "At least one entity must be selected",
        validate: (value) =>
          value.length > 0 || "At least one entity must be selected",
      }}
      render={({ field }) => (
        <FormControl fullWidth margin="normal" error={!!errors.entity_ids}>
          <InputLabel shrink>
            {`Select ${entityType === "resource" ? "Resources" : "Executors"}`}
          </InputLabel>
          <Box sx={{ mt: 1 }}>
            <FilterPanel
              filters={filterConfigs}
              storageKey={`filter_batch_operation_${entityType}`}
              onFilterChange={handleFilterChange}
            />
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

                  setValue("entity_ids", nextSelected, {
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
            {errors.entity_ids
              ? errors.entity_ids.message
              : `Select ${entityType}s to include in this batch operation`}
          </FormHelperText>
        </FormControl>
      )}
    />
  );
};
