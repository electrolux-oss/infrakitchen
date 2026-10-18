import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Control,
  Controller,
  FieldErrors,
  UseFormSetValue,
  useWatch,
} from "react-hook-form";

import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { FilterProvider } from "../../common/components/filter_panel/FilterContext";
import { FilterPanel } from "../../common/components/filter_panel/FilterPanel";
import { useConfig } from "../../common/context/ConfigContext";
import { useLocalStorage } from "../../common/context/UIStateContext";
import { buildGraphqlFields } from "../../common/graphql/buildGraphqlFields";
import { notifyError } from "../../common/hooks/useNotification";
import { usePersistedPagination } from "../../common/hooks/usePersistedPagination";
import StatusChip from "../../common/StatusChip";
import { executorColumns as filterableExecutorColumns } from "../../executors/components/executorTableConfig";
import { EXECUTOR_FIELD_MAP } from "../../executors/graphql";
import { resourceColumns as filterableResourceColumns } from "../../resources/components/resourceTableConfig";
import { RESOURCE_FIELD_MAP } from "../../resources/graphql";
import { IkEntity } from "../../types";
import { FormControl, FormHelperText, InputLabel } from "../../ui";
import { DataTable, RenderCellParams, SortModel } from "../../ui";
import { BatchOperationCreate } from "../types";

// State + Created columns are identical across the resource and executor
// selection grids; defined once so they can't drift apart.
const selectionStateColumn: EntityTableColumn = {
  field: "state",
  headerName: "State",
  flex: 1,
  valueGetter: (_value: any, row: any) => `${row.state}-${row.status}`,
  renderCell: (params: RenderCellParams) => (
    <StatusChip
      status={String(params.row.status).toLowerCase()}
      state={String(params.row.state).toLowerCase()}
    />
  ),
};

const selectionCreatedAtColumn: EntityTableColumn = {
  field: "createdAt",
  headerName: "Created",
  width: RELATIVE_TIME_COLUMN_WIDTH,
  renderCell: (params: RenderCellParams) => (
    <RelativeTime className="flex justify-end" date={params.value} compact />
  ),
};

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
  const [paginationModel, setPaginationModel] = usePersistedPagination(
    "batch_operation_entity_selector_pageSize",
    10,
    [10, 25, 50, 100],
  );
  const [sortModel, setSortModel] = useState<SortModel>([]);

  const resourceSelectionColumns: EntityTableColumn[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        fetchFields: ["name", "id", "entityName"],
        flex: 1,
        hideable: false,
        renderCell: (params: RenderCellParams) => {
          return <Entity entity={params.row} />;
        },
      },
      {
        field: "template",
        headerName: "Template",
        flex: 1,
        valueGetter: (value: any) => value?.name || "",
        renderCell: (params: RenderCellParams) => {
          const template = params.row.template;
          return <Entity entity={template} />;
        },
      },
      {
        field: "sourceCodeVersion",
        headerName: "Template Version",
        flex: 1,
        fetchFields: [
          "sourceCodeVersion.sourceCodeVersion",
          "sourceCodeVersion.sourceCodeBranch",
          "sourceCodeVersion.lifecycleState",
          "sourceCodeVersion.breakingChanges",
          "sourceCodeVersion.identifier",
          "sourceCodeVersion.entityName",
          "sourceCodeVersion.id",
        ],
        sortField: "source_code_version.source_code_version",
        valueGetter: (_value: any, row: any) => {
          const scv = row.sourceCodeVersion;
          if (!scv) return "";
          return scv.sourceCodeVersion ?? scv.sourceCodeBranch;
        },
        renderCell: (params: RenderCellParams) => {
          const scv = params.row.sourceCodeVersion;
          if (!scv) return null;
          return <Entity entity={scv} lifecycleVariant="dot" />;
        },
      },

      selectionStateColumn,
      selectionCreatedAtColumn,
    ],
    [],
  );

  const executorSelectionColumns: EntityTableColumn[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        fetchFields: ["name", "id", "entityName"],
        flex: 1,
        hideable: false,
        renderCell: (params: RenderCellParams) => {
          return <Entity entity={params.row} />;
        },
      },
      {
        field: "sourceCode",
        headerName: "Source Code",
        flex: 1,
        valueGetter: (_value: any, row: any) =>
          row.sourceCode?.identifier || "",
        renderCell: (params: RenderCellParams) => {
          const sourceCodeVersion = params.row.sourceCode;
          return <Entity entity={sourceCodeVersion} />;
        },
      },
      selectionStateColumn,
      selectionCreatedAtColumn,
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

  const sortFieldMap = useMemo(
    () =>
      new Map(
        columns
          .filter((column) => column.sortField)
          .map((column) => [column.field!, column.sortField!]),
      ),
    [columns],
  );

  const filterColumns = useMemo<EntityTableColumn[]>(
    () =>
      entityType === "resource"
        ? filterableResourceColumns
        : filterableExecutorColumns,
    [entityType],
  );

  const handleFilterChange = useCallback(
    (values: Record<string, any>) => {
      setFilterValues(values);
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
    },
    [setPaginationModel],
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
            field: sortFieldMap.get(sort.field) ?? sort.field,
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
    sortFieldMap,
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
          <InputLabel>
            {`Select ${entityType === "resource" ? "Resources" : "Executors"}`}
          </InputLabel>
          <div className="mt-2">
            <FilterProvider
              columns={filterColumns}
              storageKey={`filter_batch_operation_${entityType}`}
              onFilterChange={handleFilterChange}
            >
              <FilterPanel />
            </FilterProvider>
            <div className="mt-4 w-full overflow-hidden rounded-surface border border-divider bg-paper">
              <DataTable
                rows={entities}
                columns={columns}
                loading={loading}
                rowCount={totalRows}
                paginationMode="server"
                sortingMode="server"
                checkboxSelection
                rowSelectionModel={
                  Array.isArray(selectedEntityIds) ? selectedEntityIds : []
                }
                onRowSelectionModelChange={(newSelection) => {
                  // Ids from other pages stay in the model, so it is the
                  // whole selection.
                  const nextSelected = newSelection.map(String);
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
                className="md:min-h-[380px]"
              />
            </div>
          </div>
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
