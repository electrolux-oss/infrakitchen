import { GridColumnVisibilityModel } from "@mui/x-data-grid";

import { GraphqlFieldMap } from "../../graphql/buildGraphqlFields";

import { EntityTableColumn } from "./EntityTable";

export interface EntityFetchTableProps {
  title: string;
  subtitle?: string;
  columns: EntityTableColumn[];
  entityName?: string;
  defaultColumnVisibilityModel?: GridColumnVisibilityModel;
  onFilterChange?: (filterValues: Record<string, any>) => void;
  defaultFilter?: Record<string, any>;
  initialFilters?: Record<string, any>;
  buildApiFilters?: (filterValues: Record<string, any>) => Record<string, any>;
  filterStorageKey?: string;
  entityFieldMap?: GraphqlFieldMap;
  transformFn?: (data: any) => any;
  syncFiltersToUrl?: boolean;
  defaultSort?: { field: string; sort: "asc" | "desc" };
  /** Set to false for tables whose rows shouldn't offer a click affordance. */
  rowClickable?: boolean;
}

export interface EntityFetchTableRef {
  refresh: () => Promise<void>;
}
