import { useState, useEffect, useMemo } from "react";

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
  columns: EntityTableColumn[];
  entityName?: string;
  fields?: string[];
  defaultColumnVisibilityModel?: GridColumnVisibilityModel;
  filterConfigs?: FilterConfig[];
  onFilterChange?: (filterValues: Record<string, any>) => void;
  defaultFilter?: Record<string, any>;
  initialFilters?: Record<string, any>;
  buildApiFilters?: (filterValues: Record<string, any>) => Record<string, any>;
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
    columns,
    entityName,
    fields = [],
    defaultColumnVisibilityModel,
    filterConfigs,
    onFilterChange,
    defaultFilter,
    initialFilters,
    buildApiFilters,
  } = props;

  const { ikApi } = useConfig();
  const { get, setKey } = useLocalStorage<Record<string, unknown>>();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IkEntity[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  const filterStorageKey = `filter_${title.toLowerCase().replace(/\s+/g, "_")}`;
  const hasFilters = Boolean(filterConfigs && filterConfigs.length > 0);

  const multiFilterState = useMultiFilterState({
    storageKey: filterStorageKey,
    initialValues: {},
  });

  const currentFilterValues = useMemo(
    () => (hasFilters ? multiFilterState.filterValues : {}),
    [hasFilters, multiFilterState.filterValues],
  );

  const storageKey = `entityTable_${title.toLowerCase().replace(/\s+/g, "_")}`;
  const savedState = get(storageKey) as DataGridState | undefined;

  useEffect(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      multiFilterState.setFilterValues(initialFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on first mount

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
    useState<GridColumnVisibilityModel>(
      savedState?.columnVisibilityModel || defaultColumnVisibilityModel || {},
    );

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
    const requested = new Set<string>(["id"]);
    const baseColumnFields = new Set(columns.map((column) => column.field));

    columns.forEach((column) => {
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

    fields.forEach((field) => {
      if (
        !baseColumnFields.has(field) &&
        columnVisibilityModel[field] === true
      ) {
        requested.add(field);
      }
    });

    return Array.from(requested);
  }, [columns, columnVisibilityModel, fields]);

  const fetchFilteredData = useMemo(() => {
    return async () => {
      const page = paginationPage;
      const pageSize = paginationPageSize;

      let apiFilters: Record<string, any> = {};

      if (filterConfigs) {
        if (buildApiFilters) {
          apiFilters = buildApiFilters(currentFilterValues);
        } else {
          apiFilters = buildDefaultApiFilters(
            currentFilterValues,
            filterConfigs,
          );
        }
      } else if (defaultFilter) {
        apiFilters = { ...defaultFilter };
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
    filterConfigs,
    buildApiFilters,
    currentFilterValues,
    defaultFilter,
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
            storageKey={filterStorageKey}
            onFilterChange={onFilterChange}
          />
        )}
        <EntityTable
          entityName={title}
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
        />
      </Box>
    </>
  );
};
