export type FilterType =
  | "search"
  | "autocomplete"
  | "select"
  | "multi-select"
  | "cascading";

export interface BaseFilterConfig {
  id: string;
  type: FilterType;
  label: string;
  width?: number | string;
  placeholder?: string;
}

export interface CascadingOption {
  label: string;
  value: string;
  children?: CascadingOption[];
}

export interface SearchFilterConfig extends BaseFilterConfig {
  type: "search";
}

export interface AutocompleteFilterConfig extends BaseFilterConfig {
  type: "autocomplete";
  options: string[] | (() => Promise<string[]>);
  multiple?: boolean;
  maxChipsToShow?: number;
  filterSelectedOptions?: boolean;
  disableCloseOnSelect?: boolean;
}

export interface SelectFilterConfig extends BaseFilterConfig {
  type: "select";
  options: Array<{ label: string; value: string }>;
}

export interface MultiSelectFilterConfig extends BaseFilterConfig {
  type: "multi-select";
  options: Array<{ label: string; value: string }>;
}

export interface CascadingFilterConfig extends BaseFilterConfig {
  type: "cascading";
  options: CascadingOption[];
}

export type FilterConfig =
  | SearchFilterConfig
  | AutocompleteFilterConfig
  | SelectFilterConfig
  | MultiSelectFilterConfig
  | CascadingFilterConfig;

export interface FilterState {
  [filterId: string]: any;
}

export interface FilterPanelProps {
  filters: FilterConfig[];
  storageKey: string;
  onFilterChange?: (filterValues: FilterState) => void;
}
