import {
  forwardRef,
  useState,
  useEffect,
  useMemo,
  useRef,
  useImperativeHandle,
} from "react";

import { useEffectOnce } from "react-use";

import { Box } from "@mui/material";
import {
  GridFilterModel,
  GridPaginationModel,
  GridSortModel,
  GridColumnVisibilityModel,
} from "@mui/x-data-grid";
import { GridSortItem } from "@mui/x-data-grid/models/gridSortModel";

import { useConfig, useLocalStorage } from "..";
import { IkEntity } from "../../types";
import {
  buildGraphqlFields,
  GraphqlFieldMap,
} from "../graphql/buildGraphqlFields";
import { useMultiFilterState } from "../hooks/useFilterState";
import { notifyError } from "../hooks/useNotification";

import { EntityTable, EntityTableColumn } from "./EntityTable";
import { FilterConfig } from "./filter_panel/FilterConfig";
import { FilterPanel } from "./filter_panel/FilterPanel";

interface EntityFetchTableProps {
  title: string;
  subtitle?: string;
  columns: EntityTableColumn[];
  entityName?: string;
  defaultColumnVisibilityModel?: GridColumnVisibilityModel;
  filterConfigs?: FilterConfig[];
  onFilterChange?: (filterValues: Record<string, any>) => void;
  defaultFilter?: Record<string, any>;
  initialFilters?: Record<string, any>;
  buildApiFilters?: (filterValues: Record<string, any>) => Record<string, any>;
  filterStorageKey?: string;
  entityFieldMap?: GraphqlFieldMap;
  transformFn?: (data: any) => any;
}

export interface EntityFetchTableRef {
  refresh: () => Promise<void>;
}

interface DataGridState {
  sortModel: GridSortModel;
  paginationModel: GridPaginationModel;
  columnVisibilityModel?: GridColumnVisibilityModel;
}

function buildDefaultApiFilters(
  filterValues: Record<string, any>,
  filterConfigs: FilterConfig[],
): Record<string, any> {
  const apiFilters: Record<string, any> = {};

  filterConfigs.forEach((config) => {
    const value = filterValues[config.id];

    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value) && value.length === 0) {
      return;
    }

    if (config.type === "search") {
      apiFilters[`${config.id}__like`] = value;
    } else if (config.type === "autocomplete") {
      if (config.multiple) {
        apiFilters[`${config.id}__contains_all`] = value;
      } else {
        apiFilters[config.id] = value;
      }
    } else {
      apiFilters[config.id] = value;
    }
  });

  return apiFilters;
}

export const EntityFetchTable = forwardRef<
  EntityFetchTableRef,
  EntityFetchTableProps
>((props, ref) => {
  const {
    title,
    subtitle,
    columns,
    entityName,
    defaultColumnVisibilityModel,
    filterConfigs,
    onFilterChange,
    defaultFilter,
    initialFilters,
    buildApiFilters,
    filterStorageKey,
    entityFieldMap,
    transformFn,
  } = props;

  const { ikApi } = useConfig();
  const { get, setKey } = useLocalStorage<Record<string, unknown>>();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IkEntity[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  const resolvedFilterStorageKey =
    filterStorageKey ?? `filter_${title.toLowerCase().replace(/\s+/g, "_")}`;
  const hasFilters = Boolean(filterConfigs && filterConfigs.length > 0);

  const filterConfigsRef = useRef(filterConfigs);
  filterConfigsRef.current = filterConfigs;
  const buildApiFiltersRef = useRef(buildApiFilters);
  buildApiFiltersRef.current = buildApiFilters;
  const defaultFilterRef = useRef(defaultFilter);
  defaultFilterRef.current = defaultFilter;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const multiFilterState = useMultiFilterState({
    storageKey: resolvedFilterStorageKey,
    initialValues: {},
  });

  const currentFilterValues = useMemo(
    () => (hasFilters ? multiFilterState.filterValues : {}),
    [hasFilters, multiFilterState.filterValues],
  );

  const storageKey = `entityTable_${title.toLowerCase().replace(/\s+/g, "_")}`;
  const savedState = get(storageKey) as DataGridState | undefined;

  useEffectOnce(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      multiFilterState.setFilterValues(initialFilters);
    }
  });

  const [sortModel, setSortModel] = useState<GridSortModel>(
    savedState?.sortModel || [],
  );

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>(
    savedState?.paginationModel || { page: 0, pageSize: 10 },
  );

  const [filterModel, setFilterModel] = useState<GridFilterModel>({
    items: [],
    quickFilterValues: [],
  });

  const [columnVisibilityModel, setColumnVisibilityModel] =
    useState<GridColumnVisibilityModel>(() => ({
      ...(defaultColumnVisibilityModel ?? {}),
      ...(savedState?.columnVisibilityModel ?? {}),
    }));

  const handleSortModelChange = (newSortModel: GridSortModel) => {
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    setSortModel(newSortModel);
  };

  const handlePaginationModelChange = (
    newPaginationModel: GridPaginationModel,
  ) => {
    setPaginationModel(newPaginationModel);
  };

  const handleColumnVisibilityModelChange = (
    newColumnVisibilityModel: GridColumnVisibilityModel,
  ) => {
    setColumnVisibilityModel(newColumnVisibilityModel);
  };

  const paginationPage = paginationModel.page;
  const paginationPageSize = paginationModel.pageSize;

  const requestedFields = useMemo(() => {
    const cols = columnsRef.current;
    const requested = new Set<string>(["id"]);

    cols.forEach((column) => {
      const isHidden = columnVisibilityModel[column.field] === false;
      const isNonFilterable = column.filterable === false;

      // If the column has explicit fetchFields, always include them — they are
      // required by the transform regardless of whether the column is visible.
      if (column.fetchFields !== undefined) {
        column.fetchFields.forEach((field) => {
          if (field) requested.add(field);
        });
        // Still skip adding column.field itself when column is hidden/non-filterable
        if (isHidden || isNonFilterable) return;
      } else {
        if (isHidden || isNonFilterable) return;
        requested.add(column.field);
      }
    });

    return Array.from(requested);
  }, [columnVisibilityModel]);

  const fetchFilteredData = useMemo(() => {
    return async () => {
      const page = paginationPage;
      const pageSize = paginationPageSize;

      let apiFilters: Record<string, any> = {};

      if (filterConfigsRef.current) {
        if (buildApiFiltersRef.current) {
          apiFilters = buildApiFiltersRef.current(currentFilterValues);
        } else {
          apiFilters = buildDefaultApiFilters(
            currentFilterValues,
            filterConfigsRef.current,
          );
        }
      } else if (defaultFilterRef.current) {
        apiFilters = { ...defaultFilterRef.current };
      }

      let sort: GridSortItem;
      if (sortModel.length === 0) {
        sort = { field: "created_at", sort: "desc" };
      } else {
        sort = sortModel[0] as GridSortItem;
      }

      const sortFieldMap = new Map(
        columnsRef.current
          .filter((c) => c.sortField)
          .map((c) => [c.field!, c.sortField!]),
      );
      const apiSort = sort
        ? {
            field: sortFieldMap.get(sort.field) ?? sort.field,
            order: sort.sort?.toUpperCase() as "ASC" | "DESC",
          }
        : { field: "created_at", order: "DESC" as "ASC" | "DESC" };

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
            const total = response?.[`${entityName}sCount`] || 0;
            const transformedData = transformFn
              ? listData.map(transformFn)
              : listData;
            setData(transformedData);
            setTotalRows(total);
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
    currentFilterValues,
    transformFn,
    entityFieldMap,
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

  useEffect(() => {
    setKey(storageKey, {
      sortModel,
      paginationModel,
      columnVisibilityModel,
    });
  }, [sortModel, paginationModel, columnVisibilityModel, storageKey, setKey]);

  const showFilters = filterConfigs && filterConfigs.length > 0;

  return (
    <>
      <Box sx={{ maxWidth: 1400, width: "100%", alignSelf: "center" }}>
        {showFilters && (
          <FilterPanel
            filters={filterConfigs}
            storageKey={resolvedFilterStorageKey}
            onFilterChange={onFilterChange}
          />
        )}
        <EntityTable
          entityName={title}
          subtitle={subtitle}
          columns={columns}
          totalRows={totalRows}
          entities={data}
          loading={loading}
          paginationModel={paginationModel}
          sortModel={sortModel}
          filterModel={filterModel}
          handleSortModelChange={handleSortModelChange}
          handlePaginationModelChange={handlePaginationModelChange}
          setFilterModel={setFilterModel}
          columnVisibilityModel={columnVisibilityModel}
          handleColumnVisibilityModelChange={handleColumnVisibilityModelChange}
          onRefresh={fetchFilteredData}
        />
      </Box>
    </>
  );
});

EntityFetchTable.displayName = "EntityFetchTable";
