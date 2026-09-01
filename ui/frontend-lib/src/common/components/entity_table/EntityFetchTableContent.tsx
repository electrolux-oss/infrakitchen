import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import { Box } from "@mui/material";
import {
  GridColumnVisibilityModel,
  GridPaginationModel,
  GridSortModel,
} from "@mui/x-data-grid";

import { useConfig } from "../..";
import { IkEntity } from "../../../types";
import {
  buildGraphqlFields,
  GraphqlFieldMap,
} from "../../graphql/buildGraphqlFields";
import { notifyError } from "../../hooks/useNotification";
import { useFilterContext } from "../filter_panel/FilterContext";
import { FilterPanel } from "../filter_panel/FilterPanel";

import { EntityFetchTableRef } from "./EntityFetchTable.types";
import { EntityTable, EntityTableColumn } from "./EntityTable";

interface EntityFetchTableContentProps {
  title: string;
  subtitle?: string;
  columns: EntityTableColumn[];
  entityName?: string;
  defaultFilter?: Record<string, any>;
  initialFilters?: Record<string, any>;
  entityFieldMap?: GraphqlFieldMap;
  transformFn?: (data: any) => any;
  rowClickable?: boolean;
  buildApiFiltersRef: MutableRefObject<
    ((filterValues: Record<string, any>) => Record<string, any>) | undefined
  >;
  defaultFilterRef: MutableRefObject<Record<string, any> | undefined>;
  columnsRef: MutableRefObject<EntityTableColumn[]>;
  defaultSort?: { field: string; sort: "asc" | "desc" };
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  data: IkEntity[];
  setData: Dispatch<SetStateAction<IkEntity[]>>;
  totalRows: number;
  setTotalRows: Dispatch<SetStateAction<number>>;
  paginationModel: GridPaginationModel;
  sortModel: GridSortModel;
  columnVisibilityModel: GridColumnVisibilityModel;
  requestedFields: string[];
  handleSortModelChange: (newSortModel: GridSortModel) => void;
  handlePaginationModelChange: (
    newPaginationModel: GridPaginationModel,
  ) => void;
  handleColumnVisibilityModelChange: (
    newColumnVisibilityModel: GridColumnVisibilityModel,
  ) => void;
}

export const EntityFetchTableContent = forwardRef<
  EntityFetchTableRef,
  EntityFetchTableContentProps
>((props, ref) => {
  const {
    title,
    subtitle,
    columns,
    entityName,
    defaultFilter,
    initialFilters,
    entityFieldMap,
    transformFn,
    rowClickable,
    buildApiFiltersRef,
    defaultFilterRef,
    columnsRef,
    defaultSort,
    loading,
    setLoading,
    data,
    setData,
    totalRows,
    setTotalRows,
    paginationModel,
    sortModel,
    columnVisibilityModel,
    requestedFields,
    handleSortModelChange,
    handlePaginationModelChange,
    handleColumnVisibilityModelChange,
  } = props;

  const { ikApi } = useConfig();
  const { filters, filterValues, setFilterValues, hasFilters } =
    useFilterContext();

  const appliedInitialFiltersRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialFilters || Object.keys(initialFilters).length === 0) {
      return;
    }

    const serializedInitialFilters = JSON.stringify(initialFilters);
    if (appliedInitialFiltersRef.current === serializedInitialFilters) {
      return;
    }

    appliedInitialFiltersRef.current = serializedInitialFilters;
    setFilterValues(initialFilters);
  }, [initialFilters, setFilterValues]);

  const paginationPage = paginationModel.page;
  const paginationPageSize = paginationModel.pageSize;

  const fetchFilteredData = useMemo(() => {
    return async () => {
      const page = paginationPage;
      const pageSize = paginationPageSize;

      let apiFilters: Record<string, any> = {};

      if (filters.length > 0) {
        if (buildApiFiltersRef.current) {
          apiFilters = buildApiFiltersRef.current(filterValues);
        }
      } else if (defaultFilterRef.current ?? defaultFilter) {
        apiFilters = { ...(defaultFilterRef.current ?? defaultFilter) };
      }

      let sort: NonNullable<GridSortModel[number]>;
      if (sortModel.length === 0) {
        sort = defaultSort ?? { field: "created_at", sort: "desc" };
      } else {
        sort = sortModel[0] as NonNullable<GridSortModel[number]>;
      }

      const sortFieldMap = new Map(
        columnsRef.current
          .filter((column: EntityTableColumn) => column.sortField)
          .map((column: EntityTableColumn) => [
            column.field!,
            column.sortField!,
          ]),
      );
      const apiSort = {
        field: sortFieldMap.get(sort.field) ?? sort.field,
        order: (sort.sort ?? "desc").toUpperCase() as "ASC" | "DESC",
      };

      setLoading(true);

      try {
        const fetchParams = {
          filter: apiFilters,
          pagination: { page: page + 1, perPage: pageSize },
          sort: apiSort,
          fields: requestedFields,
        };

        await ikApi
          .graphqlRequest(
            `query Query($filter: JSON, $sort: [String!], $range: [Int!]) {
                            ${entityName}s(filter: $filter, sort: $sort, range: $range) {
                            ${buildGraphqlFields(
                              fetchParams.fields,
                              entityFieldMap || {},
                            )}
                            }
                            ${entityName}sCount(filter: $filter)
                    }`,
            {
              filter: fetchParams.filter,
              sort: [fetchParams.sort.field, fetchParams.sort.order],
              range: [
                (fetchParams.pagination.page - 1) *
                  fetchParams.pagination.perPage,
                fetchParams.pagination.page * fetchParams.pagination.perPage,
              ],
            },
          )
          .then((response: any) => {
            const listData = response?.[`${entityName}s`] || [];
            const nextTotalRows = response?.[`${entityName}sCount`] || 0;
            const transformedData = transformFn
              ? listData.map(transformFn)
              : listData;

            setData(transformedData);
            setTotalRows(nextTotalRows);
          });
      } catch (e) {
        notifyError(e);
      } finally {
        setLoading(false);
      }
    };
  }, [
    ikApi,
    requestedFields,
    entityName,
    paginationPage,
    paginationPageSize,
    sortModel,
    filterValues,
    filters,
    transformFn,
    entityFieldMap,
    buildApiFiltersRef,
    defaultFilterRef,
    defaultFilter,
    columnsRef,
    setLoading,
    setData,
    setTotalRows,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      refresh: fetchFilteredData,
    }),
    [fetchFilteredData],
  );

  useEffect(() => {
    fetchFilteredData();
  }, [fetchFilteredData]);

  return (
    <Box
      sx={{
        maxWidth: "100%",
        width: "100%",
        alignSelf: "center",
      }}
    >
      {hasFilters && <FilterPanel />}
      <EntityTable
        entityName={title}
        subtitle={subtitle}
        columns={columns}
        totalRows={totalRows}
        entities={data}
        loading={loading}
        paginationModel={paginationModel}
        sortModel={sortModel}
        filterModel={{ items: [], quickFilterValues: [] }}
        handleSortModelChange={handleSortModelChange}
        handlePaginationModelChange={handlePaginationModelChange}
        setFilterModel={() => undefined}
        columnVisibilityModel={columnVisibilityModel}
        handleColumnVisibilityModelChange={handleColumnVisibilityModelChange}
        onRefresh={fetchFilteredData}
        rowClickable={rowClickable}
      />
    </Box>
  );
});

EntityFetchTableContent.displayName = "EntityFetchTableContent";
