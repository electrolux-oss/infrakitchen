import { useState, useEffect, useMemo, useRef } from "react";

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
  fields?: string[];
  defaultColumnVisibilityModel?: GridColumnVisibilityModel;
  filterConfigs?: FilterConfig[];
  onFilterChange?: (filterValues: Record<string, any>) => void;
  onDataLoaded?: (data: IkEntity[]) => void;
  defaultFilter?: Record<string, any>;
  initialFilters?: Record<string, any>;
  buildApiFilters?: (filterValues: Record<string, any>) => Record<string, any>;
  filterStorageKey?: string;
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

export const EntityFetchTable = (props: EntityFetchTableProps) => {
  const {
    title,
    subtitle,
    columns,
    entityName,
    fields = [],
    defaultColumnVisibilityModel,
    filterConfigs,
    onFilterChange,
    onDataLoaded,
    defaultFilter,
    initialFilters,
    buildApiFilters,
    filterStorageKey,
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
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const onDataLoadedRef = useRef(onDataLoaded);
  onDataLoadedRef.current = onDataLoaded;

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
    const flds = fieldsRef.current;
    const requested = new Set<string>(["id"]);
    const baseColumnFields = new Set(cols.map((column) => column.field));

    cols.forEach((column) => {
      if (columnVisibilityModel[column.field] === false) {
        return;
      }

      const fetchFields = column.fetchFields ?? [column.field];
      fetchFields.forEach((field) => {
        if (field) {
          requested.add(field);
        }
      });
    });

    flds.forEach((field) => {
      if (
        !baseColumnFields.has(field) &&
        columnVisibilityModel[field] === true
      ) {
        requested.add(field);
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

      const apiSort = sort
        ? {
            field: sort.field,
            order: sort.sort?.toUpperCase() as "ASC" | "DESC",
          }
        : { field: "created_at", order: "DESC" as "ASC" | "DESC" };

      setLoading(true);
      try {
        const response = await ikApi.getList(`${entityName}s`, {
          filter: apiFilters,
          pagination: { page: page + 1, perPage: pageSize },
          sort: apiSort,
          fields: requestedFields,
        });
        setData(response.data);
        setTotalRows(response.total ? response.total : 0);
        onDataLoadedRef.current?.(response.data);
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
  ]);

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
          availableFields={fields}
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
};
