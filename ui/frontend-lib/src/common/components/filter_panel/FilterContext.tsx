import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
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
  resetFilters: () => void;
  resetFilter: (filterId: string) => void;
  hasActiveFilters: boolean;
  hasUnsavedFilters: boolean;
  saveFilters?: () => void;
  syncToUrl: boolean;
  hasFilters: boolean;
  isFilterPanelOpen: boolean;
  setFilterPanelOpen: (isOpen: boolean) => void;
  toggleFilterPanel: () => void;
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
  const [isFilterPanelOpen, setFilterPanelOpen] = useState(false);
  const hasFilters = filters.length > 0;

  useEffect(() => {
    if (!hasFilters) {
      setFilterPanelOpen(false);
      return;
    }

    if (filterState.hasActiveFilters) {
      setFilterPanelOpen(true);
    }
  }, [hasFilters, filterState.hasActiveFilters]);

  useEffect(() => {
    onFilterChange?.(filterState.filterValues);
  }, [filterState.filterValues, onFilterChange]);

  const value = useMemo<FilterContextValue>(
    () => ({
      filters,
      filterValues: filterState.filterValues,
      setFilterValue: filterState.setFilterValue,
      setFilterValues: filterState.setFilterValues,
      resetFilters: filterState.resetFilters,
      resetFilter: filterState.resetFilter,
      hasActiveFilters: filterState.hasActiveFilters,
      hasUnsavedFilters: filterState.hasUnsavedFilters,
      saveFilters: filterState.saveFilters,
      syncToUrl,
      hasFilters,
      isFilterPanelOpen,
      setFilterPanelOpen,
      toggleFilterPanel: () => {
        setFilterPanelOpen((current) => !current);
      },
    }),
    [
      filters,
      filterState.filterValues,
      filterState.setFilterValue,
      filterState.setFilterValues,
      filterState.resetFilters,
      filterState.resetFilter,
      filterState.hasActiveFilters,
      filterState.hasUnsavedFilters,
      filterState.saveFilters,
      syncToUrl,
      hasFilters,
      isFilterPanelOpen,
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
