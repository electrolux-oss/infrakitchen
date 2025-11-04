import { useState, useEffect, useCallback } from "react";

import { useLocalStorage } from "../context/UIStateContext";

interface FilterState {
  search: string;
  selectedFilters: string[];
}

interface UseFilterStateOptions {
  storageKey?: string;
}

/**
 * Hook to manage filter state with localStorage persistence.
 * Automatically syncs state across multiple instances using the same storageKey.
 */
export function useFilterState(options?: UseFilterStateOptions) {
  const { storageKey } = options || {};
  const {
    get,
    setKey,
    value: contextValue,
  } = useLocalStorage<Record<string, FilterState>>();

  // Initialize from localStorage
  const getInitialState = useCallback(() => {
    if (!storageKey) {
      return { search: "", selectedFilters: [] };
    }

    const savedState = get(storageKey);
    if (savedState) {
      return {
        search: savedState.search || "",
        selectedFilters: savedState.selectedFilters || [],
      };
    }

    return { search: "", selectedFilters: [] };
  }, [storageKey, get]);

  const [search, setSearch] = useState<string>(() => getInitialState().search);
  const [selectedFilters, setSelectedFilters] = useState<string[]>(
    () => getInitialState().selectedFilters,
  );

  // Sync with localStorage context when it changes (enables multi-instance sync)
  useEffect(() => {
    if (!storageKey) return;

    const stored = contextValue?.[storageKey];
    if (stored) {
      if (stored.search !== search) {
        setSearch(stored.search || "");
      }
      if (
        JSON.stringify(stored.selectedFilters) !==
        JSON.stringify(selectedFilters)
      ) {
        setSelectedFilters(stored.selectedFilters || []);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextValue, storageKey]); // Intentionally not including search/selectedFilters to avoid loops

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (!storageKey) return;

    setKey(storageKey, {
      search,
      selectedFilters,
    });
  }, [search, selectedFilters, storageKey, setKey]);

  return {
    search,
    setSearch,
    selectedFilters,
    setSelectedFilters,
  };
}
