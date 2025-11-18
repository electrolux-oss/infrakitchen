import { useState, useEffect, useCallback } from "react";

import { useLocalStorage } from "../context/UIStateContext";

/**
 * Filter state interface supporting multiple arbitrary filters
 */
export interface MultiFilterState {
  [filterId: string]: any;
}

interface UseMultiFilterStateOptions {
  storageKey: string;
  initialValues?: MultiFilterState;
}

interface UseMultiFilterStateReturn {
  filterValues: MultiFilterState;
  setFilterValue: (filterId: string, value: any) => void;
  setFilterValues: (values: MultiFilterState) => void;
  resetFilters: () => void;
  resetFilter: (filterId: string) => void;
  hasActiveFilters: boolean;
}

/**
 * Hook to manage multiple filters with localStorage persistence.
 * Supports arbitrary filter types and values.
 */
export function useMultiFilterState(
  options: UseMultiFilterStateOptions,
): UseMultiFilterStateReturn {
  const { storageKey, initialValues = {} } = options;
  const {
    get,
    setKey,
    value: contextValue,
  } = useLocalStorage<Record<string, MultiFilterState>>();

  // Initialize from localStorage or use initial values
  const getInitialState = useCallback(() => {
    const savedState = get(storageKey);
    if (savedState && Object.keys(savedState).length > 0) {
      return savedState;
    }
    return initialValues;
  }, [storageKey, get, initialValues]);

  const [filterValues, setFilterValuesState] = useState<MultiFilterState>(() =>
    getInitialState(),
  );

  // Sync with localStorage context when it changes (enables multi-instance sync)
  useEffect(() => {
    const stored = contextValue?.[storageKey];
    if (stored && JSON.stringify(stored) !== JSON.stringify(filterValues)) {
      setFilterValuesState(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextValue, storageKey]);

  // Save to localStorage whenever state changes
  useEffect(() => {
    setKey(storageKey, filterValues);
  }, [filterValues, storageKey, setKey]);

  const setFilterValue = useCallback((filterId: string, value: any) => {
    setFilterValuesState((prev) => ({
      ...prev,
      [filterId]: value,
    }));
  }, []);

  const setFilterValues = useCallback((values: MultiFilterState) => {
    setFilterValuesState(values);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterValuesState(initialValues);
  }, [initialValues]);

  const resetFilter = useCallback((filterId: string) => {
    setFilterValuesState((prev) => {
      const updated = { ...prev };
      delete updated[filterId];
      return updated;
    });
  }, []);

  const hasActiveFilters = Object.values(filterValues).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
  });

  return {
    filterValues,
    setFilterValue,
    setFilterValues,
    resetFilters,
    resetFilter,
    hasActiveFilters,
  };
}
