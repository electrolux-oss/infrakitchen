import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
} from "react";

import { useConfig } from "../..";
import { useFilterState } from "../../hooks";
import type { EntityTableColumn } from "../entity_table/EntityTable";

import { deriveFilterableFields } from "./deriveFilterableFields";
import { FilterConfig, FilterState } from "./FilterConfig";

interface FilterProviderProps extends PropsWithChildren {
  columns: EntityTableColumn[];
  storageKey: string;
  syncToUrl?: boolean;
  onFilterChange?: (filterValues: FilterState) => void;
}

interface FilterContextValue {
  filters: FilterConfig[];
  filterValues: FilterState;
  setFilterValue: (filterId: string, value: any) => void;
  setFilterValues: (values: FilterState) => void;
  syncToUrl: boolean;
  hasFilters: boolean;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider(props: FilterProviderProps) {
  const {
    children,
    columns,
    storageKey,
    syncToUrl = false,
    onFilterChange,
  } = props;

  const { ikApi, globalConfig } = useConfig();

  const filters = useMemo<FilterConfig[]>(() => {
    const fields = deriveFilterableFields(columns, {
      ikApi,
      options: {
        entities: globalConfig.entities,
      },
    });

    if (fields.length === 0) {
      return [];
    }

    return [
      {
        id: "filter",
        label: "Filters",
        fields,
        defaultField: fields.find((field) => field.defaultSelected)?.field,
      },
    ];
  }, [columns, ikApi, globalConfig.entities]);

  const filterState = useFilterState({
    storageKey,
    filterConfigs: filters,
    syncToUrl,
  });
  const hasFilters = filters.length > 0;

  useEffect(() => {
    onFilterChange?.(filterState.filterValues);
  }, [filterState.filterValues, onFilterChange]);

  const value = useMemo<FilterContextValue>(
    () => ({
      filters,
      filterValues: filterState.filterValues,
      setFilterValue: filterState.setFilterValue,
      setFilterValues: filterState.setFilterValues,
      syncToUrl,
      hasFilters,
    }),
    [
      filters,
      filterState.filterValues,
      filterState.setFilterValue,
      filterState.setFilterValues,
      syncToUrl,
      hasFilters,
    ],
  );

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

export function useFilterContext() {
  const context = useContext(FilterContext);

  if (!context) {
    throw new Error("useFilterContext must be used within a FilterProvider");
  }

  return context;
}
