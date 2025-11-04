import { useState, useEffect, useCallback } from "react";

import { Box } from "@mui/material";
import {
  GridFilterModel,
  GridPaginationModel,
  GridSortModel,
} from "@mui/x-data-grid";
import { GridSortItem } from "@mui/x-data-grid/models/gridSortModel";

import { useConfig, useLocalStorage } from "..";
import { IkEntity } from "../../types";
import { useFilterState } from "../hooks/useFilterState";
import { notifyError } from "../hooks/useNotification";

import { EntityTable } from "./EntityTable";
import { FilterPanel } from "./FilterPanel";

interface EntityFetchTableProps {
  title: string;
  columns: any;
  entityName?: string;
  filters?: string[];
  filterName?: string;
  filterOperator?: string;
  fields?: string[];
  searchName?: string;
}

interface DataGridState {
  sortModel: GridSortModel;
  paginationModel: GridPaginationModel;
}

export const EntityFetchTable = (props: EntityFetchTableProps) => {
  const {
    title,
    columns,
    entityName,
    filterName,
    searchName,
    filters = [],
    fields = [],
    filterOperator,
  } = props;

  const { ikApi } = useConfig();
  const { get, setKey } = useLocalStorage<Record<string, DataGridState>>();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IkEntity[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  const { search, selectedFilters } = useFilterState({
    storageKey: `filter_${entityName}s`,
  });

  const storageKey = `entityTable_${entityName}`;
  const savedState = get(storageKey);

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

  // This will filter entities based on the search input
  // after a short delay to avoid excessive re-renders
  useEffect(() => {
    const id = setTimeout(() => {
      const tokens = search
        .split(" ")
        .map((s) => s.trim())
        .filter(Boolean);
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
      setFilterModel((prev) => ({ ...prev, quickFilterValues: tokens }));
    }, 150);
    return () => clearTimeout(id);
  }, [search]);

  const handleSortModelChange = (newSortModel: GridSortModel) => {
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
    setSortModel(newSortModel);
  };

  const handlePaginationModelChange = (
    newPaginationModel: GridPaginationModel,
  ) => {
    setPaginationModel(newPaginationModel);
  };

  const fetchFilteredData = useCallback(async () => {
    const { page, pageSize } = paginationModel;
    let sort: GridSortItem;
    if (sortModel.length === 0) {
      sort = { field: "created_at", sort: "desc" };
    } else {
      sort = sortModel[0] as GridSortItem;
    }
    const quickFilterValues = filterModel.quickFilterValues;

    const apiSort = sort
      ? {
          field: sort.field,
          order: sort.sort?.toUpperCase() as "ASC" | "DESC",
        }
      : { field: "created_at", order: "DESC" as "ASC" | "DESC" };

    const apiFilters: Record<string, any> = {};
    if (filterName && selectedFilters && selectedFilters.length > 0) {
      apiFilters[`${filterName}${filterOperator ?? ""}`] = selectedFilters;
    }

    if (searchName && quickFilterValues && quickFilterValues.length > 0) {
      apiFilters[`${searchName}__like`] = quickFilterValues.join(" ");
    }

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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ikApi,
    entityName,
    paginationModel,
    sortModel,
    filterModel,
    filterName,
    searchName,
    filterOperator,
    selectedFilters,
  ]);

  useEffect(() => {
    fetchFilteredData();
  }, [fetchFilteredData]);

  useEffect(() => {
    setKey(storageKey, { sortModel, paginationModel });
  }, [sortModel, paginationModel, storageKey, setKey]);

  return (
    <>
      <Box sx={{ maxWidth: 1400, width: "100%", alignSelf: "center" }}>
        {(filterName || searchName) && (
          <FilterPanel
            dropdownOptions={filters}
            filterStorageKey={`filter_${entityName}s`}
            filterName={filterName}
            searchName={searchName}
          />
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
        />
      </Box>
    </>
  );
};
