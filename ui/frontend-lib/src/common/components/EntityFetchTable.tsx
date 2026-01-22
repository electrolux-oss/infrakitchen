import { useState, useEffect, useMemo } from "react";

import { Box } from "@mui/material";
import {
  GridColDef,
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

import { EntityTable } from "./EntityTable";
import { FilterConfig } from "./filter_panel/FilterConfig";
import { FilterPanel } from "./filter_panel/FilterPanel";

interface EntityFetchTableProps {
  title: string;
  columns: GridColDef<any>[];
  entityName?: string;
  fields?: string[];
  filterConfigs?: FilterConfig[];
  defaultFilter?: Record<string, any>;
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
    filterConfigs,
    defaultFilter,
    buildApiFilters,
  } = props;

  const { ikApi } = useConfig();
  const { get, setKey } = useLocalStorage<Record<string, unknown>>();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IkEntity[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  const filterStorageKey = `filter_${entityName}s`;
  const hasFilters = Boolean(filterConfigs && filterConfigs.length > 0);

  const multiFilterState = useMultiFilterState({
    storageKey: filterStorageKey,
    initialValues: {},
  });

  const currentFilterValues = useMemo(
    () => (hasFilters ? multiFilterState.filterValues : {}),
    [hasFilters, multiFilterState.filterValues],
  );

  const storageKey = `entityTable_${entityName}`;
  const savedState = get(storageKey) as DataGridState | undefined;

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
      savedState?.columnVisibilityModel || {},
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
          fields: fields,
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
    fields,
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
          <FilterPanel filters={filterConfigs} storageKey={filterStorageKey} />
        )}
        <EntityTable
          entityName={title}
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
        />
      </Box>
    </>
  );
};
