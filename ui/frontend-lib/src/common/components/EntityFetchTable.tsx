import { useState, useEffect, useMemo } from "react";

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

interface StoredFilterState {
  search?: string;
  selectedFilters?: string[];
}

const toQuickFilterTokens = (value: string) =>
  value
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);

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
  const { get, setKey } = useLocalStorage<Record<string, unknown>>();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IkEntity[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  const filterStorageKey = `filter_${entityName}s`;
  const savedFilterState = get(filterStorageKey) as
    | StoredFilterState
    | undefined;

  const { search, selectedFilters } = useFilterState({
    storageKey: filterStorageKey,
  });

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
    quickFilterValues: toQuickFilterTokens(search ?? ""),
  });

  const savedSelectedFiltersKey = JSON.stringify(
    savedFilterState?.selectedFilters ?? [],
  );
  const selectedFiltersKey = JSON.stringify(selectedFilters ?? []);
  const savedSearchValue = savedFilterState?.search ?? "";
  const expectedQuickFiltersKey = JSON.stringify(
    toQuickFilterTokens(savedSearchValue ?? ""),
  );
  const currentQuickFiltersKey = JSON.stringify(
    filterModel.quickFilterValues ?? [],
  );

  const shouldDelayInitialFetch = Boolean(
    (filterName && (savedFilterState?.selectedFilters?.length ?? 0) > 0) ||
      (searchName && savedSearchValue.trim().length > 0),
  );

  const [filtersReady, setFiltersReady] = useState<boolean>(
    () => !shouldDelayInitialFetch,
  );

  useEffect(() => {
    const id = setTimeout(() => {
      const tokens = toQuickFilterTokens(search ?? "");

      setPaginationModel((prev) => {
        if (prev.page !== 0) {
          return { ...prev, page: 0 };
        }
        return prev;
      });

      setFilterModel((prev) => {
        const oldTokensString = prev.quickFilterValues?.join(",") || "";
        const newTokensString = tokens.join(",") || "";

        if (oldTokensString !== newTokensString) {
          return { ...prev, quickFilterValues: tokens };
        }
        return prev;
      });
    }, 500);
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

  useEffect(() => {
    if (filtersReady) {
      return;
    }

    if (!shouldDelayInitialFetch) {
      setFiltersReady(true);
      return;
    }

    const filtersMatch = savedSelectedFiltersKey === selectedFiltersKey;
    const searchMatch = savedSearchValue === (search ?? "");
    const quickFiltersMatch =
      expectedQuickFiltersKey === currentQuickFiltersKey;

    if (filtersMatch && searchMatch && quickFiltersMatch) {
      setFiltersReady(true);
    }
  }, [
    filtersReady,
    shouldDelayInitialFetch,
    savedSelectedFiltersKey,
    selectedFiltersKey,
    savedSearchValue,
    search,
    expectedQuickFiltersKey,
    currentQuickFiltersKey,
  ]);

  const quickFilterValues = filterModel.quickFilterValues;
  const paginationPage = paginationModel.page;
  const paginationPageSize = paginationModel.pageSize;

  const fetchFilteredData = useMemo(() => {
    return async () => {
      const page = paginationPage;
      const pageSize = paginationPageSize;

      const apiFilters: Record<string, any> = {};

      if (filterName && selectedFilters && selectedFilters.length > 0) {
        apiFilters[`${filterName}${filterOperator ?? ""}`] = selectedFilters;
      }

      if (searchName && quickFilterValues && quickFilterValues.length > 0) {
        apiFilters[`${searchName}__like`] = quickFilterValues.join(" ");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ikApi,
    entityName,
    paginationPage,
    paginationPageSize,
    quickFilterValues,
    filterName,
    searchName,
    filterOperator,
    selectedFilters,
    sortModel,
  ]);

  useEffect(() => {
    if (!filtersReady) {
      return;
    }
    fetchFilteredData();
  }, [fetchFilteredData, filtersReady]);

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
