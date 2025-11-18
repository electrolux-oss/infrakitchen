/**
 * Filter configuration types for the FilterPanel component.
 * Provides a declarative way to define filters with type safety.
 */

export type FilterType = "search" | "autocomplete" | "select" | "multi-select";

/**
 * Base configuration shared by all filter types
 */
export interface BaseFilterConfig {
  id: string;
  type: FilterType;
  label: string;
  width?: number | string; // e.g., 420, '100%', 'auto'
  placeholder?: string;
}

/**
 * Search filter - text input for searching
 */
export interface SearchFilterConfig extends BaseFilterConfig {
  type: "search";
}

/**
 * Autocomplete filter - dropdown with search and multi-select support
 */
export interface AutocompleteFilterConfig extends BaseFilterConfig {
  type: "autocomplete";
  options: string[] | (() => Promise<string[]>);
  multiple?: boolean;
  maxChipsToShow?: number;
  filterSelectedOptions?: boolean;
  disableCloseOnSelect?: boolean;
}

/**
 * Select filter - simple dropdown with predefined options
 */
export interface SelectFilterConfig extends BaseFilterConfig {
  type: "select";
  options: Array<{ label: string; value: string }>;
}

/**
 * Multi-select filter - dropdown with multiple selection
 */
export interface MultiSelectFilterConfig extends BaseFilterConfig {
  type: "multi-select";
  options: Array<{ label: string; value: string }>;
}

/**
 * Union type of all possible filter configurations
 */
export type FilterConfig =
  | SearchFilterConfig
  | AutocompleteFilterConfig
  | SelectFilterConfig
  | MultiSelectFilterConfig;

/**
 * Filter state - maps filter IDs to their current values
 */
export interface FilterState {
  [filterId: string]: any;
}

/**
 * Props for the FilterPanel component
 */
export interface FilterPanelProps {
  filters: FilterConfig[];
  storageKey: string;
  onFilterChange?: (filterValues: FilterState) => void;
}
