import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

  // Reference loaders are created once at derive time; keep the latest filter
  // values in a ref so those loaders can read the current clauses (e.g. to
  // scope one field's options by another field's selection) without forcing
  // the whole filter config to be re-derived on every change.
  const filterValuesRef = useRef<FilterState>({});

  const filters = useMemo<FilterConfig[]>(() => {
    const fields = deriveFilterableFields(columns, {
      ikApi,
      options: {
        entities: globalConfig.entities,
      },
      getFilterClauses: () => {
        const value = filterValuesRef.current["filter"];
        return Array.isArray(value) ? value : [];
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

  // Sync during render (not in an effect) so reference loaders invoked from
  // child mount effects in the same commit already see the latest clauses.
  filterValuesRef.current = filterState.filterValues;

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
