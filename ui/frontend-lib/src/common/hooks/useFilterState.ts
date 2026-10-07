import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLocation, useNavigate } from "react-router";

import {
  FilterConfig,
  FilterState,
} from "../components/filter_panel/FilterConfig";
import { useLocalStorage } from "../context/UIStateContext";

export interface UseFilterStateOptions {
  storageKey: string;
  filterConfigs: FilterConfig[];
  initialValues?: FilterState;
  syncToUrl?: boolean;
}

export interface UseFilterStateReturn {
  filterValues: FilterState;
  setFilterValue: (filterId: string, value: any) => void;
  setFilterValues: (values: FilterState) => void;
}

function isClauseValueEmpty(value: any): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isAdvancedClauseArray(value: any): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "field" in value[0]
  );
}

function hasFilledAdvancedClause(value: any): boolean {
  if (!isAdvancedClauseArray(value)) {
    return false;
  }

  return value.some(
    (clause: any) => clause.field && !isClauseValueEmpty(clause.value),
  );
}

function isEmptyFilterValue(value: any): boolean {
  if (value === undefined || value === null || value === "") {
    return true;
  }

  if (!Array.isArray(value)) {
    return false;
  }

  if (value.length === 0) {
    return true;
  }

  if (!isAdvancedClauseArray(value)) {
    return false;
  }

  return !hasFilledAdvancedClause(value);
}

function serializeFilterValue(
  config: FilterConfig,
  value: any,
  params: URLSearchParams,
) {
  if (isEmptyFilterValue(value) || !Array.isArray(value)) {
    return;
  }

  const validClauses = value.filter(
    (clause: any) => clause.field && !isClauseValueEmpty(clause.value),
  );

  if (validClauses.length > 0) {
    params.set(config.id, JSON.stringify(validClauses));
  }
}

function deserializeFilterValue(
  config: FilterConfig,
  params: URLSearchParams,
): any {
  const values = params.getAll(config.id);
  if (values.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(values[0]);
  } catch {
    return undefined;
  }
}

function filtersToSearchParams(
  filterValues: FilterState,
  filterConfigs: FilterConfig[],
): URLSearchParams {
  const params = new URLSearchParams();

  filterConfigs.forEach((config) => {
    serializeFilterValue(config, filterValues[config.id], params);
  });

  return params;
}

function searchParamsToFilters(
  params: URLSearchParams,
  filterConfigs: FilterConfig[],
): FilterState {
  const filters: FilterState = {};

  filterConfigs.forEach((config) => {
    const value = deserializeFilterValue(config, params);
    if (value !== undefined) {
      filters[config.id] = value;
    }
  });

  return filters;
}

function hasAnyFilterParam(
  params: URLSearchParams,
  filterConfigs: FilterConfig[],
): boolean {
  return filterConfigs.some((config) => params.has(config.id));
}

function areFilterStatesEqual(left: FilterState, right: FilterState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useFilterState(
  options: UseFilterStateOptions,
): UseFilterStateReturn {
  const {
    storageKey,
    filterConfigs,
    initialValues = {},
    syncToUrl = false,
  } = options;
  const {
    get,
    setKey,
    value: contextValue,
  } = useLocalStorage<Record<string, FilterState>>();
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const setSearchParams = useCallback(
    (nextSearchParams: URLSearchParams, options?: { replace?: boolean }) => {
      const search = nextSearchParams.toString();

      void navigate(
        {
          pathname: location.pathname,
          search: search ? `?${search}` : "",
          hash: location.hash,
        },
        { replace: options?.replace },
      );
    },
    [location.hash, location.pathname, navigate],
  );

  const getInitialState = useCallback(() => {
    const savedState = get(storageKey);
    if (savedState && Object.keys(savedState).length > 0) {
      return savedState;
    }

    return initialValues;
  }, [storageKey, get, initialValues]);

  const [storedFilterValues, setStoredFilterValues] = useState<FilterState>(
    () => getInitialState(),
  );
  const lastStoredValueRef = useRef<FilterState>(storedFilterValues);

  const [optimisticUrlFilterValues, setOptimisticUrlFilterValues] =
    useState<FilterState | null>(null);

  useEffect(() => {
    if (syncToUrl) {
      return;
    }

    const stored = contextValue?.[storageKey];
    if (
      stored &&
      JSON.stringify(stored) !== JSON.stringify(lastStoredValueRef.current)
    ) {
      setStoredFilterValues(stored);
    }
  }, [contextValue, storageKey, syncToUrl]);

  useEffect(() => {
    if (syncToUrl) {
      return;
    }

    lastStoredValueRef.current = storedFilterValues;
    setKey(storageKey, storedFilterValues);
  }, [storedFilterValues, storageKey, setKey, syncToUrl]);

  const derivedUrlFilterValues = useMemo(() => {
    const urlHasFilters = hasAnyFilterParam(searchParams, filterConfigs);
    if (urlHasFilters) {
      return searchParamsToFilters(searchParams, filterConfigs);
    }

    return {};
  }, [searchParams, filterConfigs]);

  useEffect(() => {
    if (!syncToUrl || optimisticUrlFilterValues === null) {
      return;
    }

    if (
      areFilterStatesEqual(optimisticUrlFilterValues, derivedUrlFilterValues)
    ) {
      setOptimisticUrlFilterValues(null);
    }
  }, [derivedUrlFilterValues, optimisticUrlFilterValues, syncToUrl]);

  const filterValues = syncToUrl
    ? (optimisticUrlFilterValues ?? derivedUrlFilterValues)
    : storedFilterValues;

  const setFilterValue = useCallback(
    (filterId: string, value: any) => {
      if (syncToUrl) {
        const currentFromUrl = hasAnyFilterParam(searchParams, filterConfigs)
          ? searchParamsToFilters(searchParams, filterConfigs)
          : {};
        const newValues = { ...currentFromUrl };

        if (isEmptyFilterValue(value)) {
          delete newValues[filterId];
        } else {
          newValues[filterId] = value;
        }

        setOptimisticUrlFilterValues(newValues);
        setSearchParams(filtersToSearchParams(newValues, filterConfigs), {
          replace: true,
        });
        return;
      }

      setStoredFilterValues((prev) => {
        const updated = { ...prev };

        if (isEmptyFilterValue(value)) {
          delete updated[filterId];
        } else {
          updated[filterId] = value;
        }

        return updated;
      });
    },
    [syncToUrl, searchParams, filterConfigs, setSearchParams],
  );

  const setFilterValues = useCallback(
    (values: FilterState) => {
      if (syncToUrl) {
        setOptimisticUrlFilterValues(values);
        setSearchParams(filtersToSearchParams(values, filterConfigs), {
          replace: true,
        });
        return;
      }

      setStoredFilterValues(values);
    },
    [filterConfigs, setSearchParams, syncToUrl],
  );

  return {
    filterValues,
    setFilterValue,
    setFilterValues,
  };
}
