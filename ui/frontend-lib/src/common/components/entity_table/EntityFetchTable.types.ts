import { MouseEvent, ReactNode } from "react";

import { ColumnVisibilityModel } from "../../../ui";
import { GraphqlFieldMap } from "../../graphql/buildGraphqlFields";

import { EntityTableColumn } from "./EntityTable";

export interface EntityFetchTableProps {
  title: string;
  subtitle?: string;
  columns: EntityTableColumn[];
  entityName?: string;
  defaultColumnVisibilityModel?: ColumnVisibilityModel;
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
  /** Content rendered between the filter panel and the grid (e.g. quick filter chips). */
  quickFilters?: ReactNode;
  /** Replaces the default navigation to the row's detail page. */
  onRowClick?: (row: any, event?: MouseEvent) => void;
  /** Called with the rows of every fetched page. */
  onDataChange?: (data: any[]) => void;
}

export interface EntityFetchTableRef {
  refresh: () => Promise<void>;
}
