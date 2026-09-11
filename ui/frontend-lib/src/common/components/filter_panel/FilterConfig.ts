import type { ReactNode } from "react";

export interface BaseFilterConfig {
  id: string;
  label: string;
  width?: number | string;
  placeholder?: string;
}

// --- Advanced filter types ---

export type FilterOperator =
  | "eq"
  | "not_eq"
  | "like"
  | "not_like"
  | "is_none"
  | "in"
  | "contains_all"
  | "any";

export type ValueInputType =
  "text" | "autocomplete-multiple" | "select" | "reference";

export interface ReferenceOption {
  label: string;
  value: string;
  /** Optional icon rendered before the label in autocomplete dropdowns. */
  icon?: ReactNode;
  /** Optional template name shown as a Label chip before the label text. */
  templateName?: string;
}

export type ReferenceLoader = ((
  search: string,
) => Promise<ReferenceOption[]>) & {
  resolveByIds?: (ids: string[]) => Promise<ReferenceOption[]>;
};

export interface FilterableField {
  /** API filter path, e.g. "name", "template__name", "labels" */
  field: string;
  /** Human-readable label derived from column headerName */
  label: string;
  /** Operators available for this field */
  operators: FilterOperator[];
  /** How the value input should render */
  valueType: ValueInputType;
  /** Default operator when this field is first selected */
  defaultOperator?: FilterOperator;
  /** Whether this field should seed the first empty filter row */
  defaultSelected?: boolean;
  /** Options for autocomplete-multiple / select value inputs */
  options?: string[] | (() => Promise<string[]>);
  /** Static select options (for state/status fields) */
  selectOptions?: Array<{ label: string; value: string }>;
  /**
   * Async loader for reference fields (valueType "reference").
   * @param search - user-typed search string (empty = load defaults)
   * @returns list of {label, value} options matching the search
   */
  loadReferenceOptions?: ReferenceLoader;
  /**
   * Other filter fields whose current values scope this field's options
   * (e.g. Template Version scoped by Template). When one of these values
   * changes, this field's value is cleared and the reference input is
   * remounted so options reload with the new scope.
   */
  dependencies?: string[];
}

/**
 * Declarative filter specification attached to a table column.
 * Describes how the column maps to an API filter field.
 * Reference loaders are expressed as factories so the static column
 * definition doesn't depend on runtime API instances.
 */
export interface ColumnFilterSpec {
  /** API filter field path (snake_case), e.g. "template_id", "name" */
  field: string;
  /** Override the label (defaults to column headerName) */
  label?: string;
  /** Operators available for this field */
  operators: FilterOperator[];
  /** How the value input should render */
  valueType: ValueInputType;
  /** Default operator when this field is first selected */
  defaultOperator?: FilterOperator;
  /** Whether this field should seed the first empty filter row */
  defaultSelected?: boolean;
  /** Static select options (for state/status fields) */
  selectOptions?: Array<{ label: string; value: string }>;
  /** Static string options for autocomplete-multiple inputs. */
  options?: string[];
  /** Entity name for the common labels autocomplete loader. */
  labelsEntity?: string;
  /**
   * Options key — resolved at derive time from a context map.
   * e.g. "labels" will be replaced with the actual labels array.
   */
  optionsKey?: string;
  /**
   * Factory that produces the reference loader given the runtime context.
   * Called once at derive time.
   */
  makeReferenceLoader?: (ctx: FilterDeriveContext) => ReferenceLoader;
  /**
   * Other filter fields whose current values scope this field's options
   * (e.g. Template Version scoped by Template). When one of these values
   * changes, this field's value is cleared and the reference input is
   * remounted so options reload with the new scope.
   */
  dependencies?: string[];
}

/**
 * Runtime context passed when deriving FilterableField[] from columns.
 * Consumers provide API client and dynamic options.
 */
export interface FilterDeriveContext {
  /** API client for reference loaders */
  ikApi: any;
  /** Dynamic option sets keyed by name (e.g. { labels: string[] }) */
  options?: Record<string, string[]>;
  /**
   * Live access to the panel's current advanced filter clauses. Lets a
   * reference loader scope its options by the value selected in another
   * field (e.g. Template Version options limited to the selected Template).
   * Returns the clauses for the panel's filter config.
   */
  getFilterClauses?: () => FilterClause[];
}

export interface FilterClause {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface FilterConfig extends BaseFilterConfig {
  /** Filterable fields available in the query builder */
  fields: FilterableField[];
  /** Default field preselected in the empty clause row */
  defaultField?: string;
}

export interface FilterState {
  [filterId: string]: any;
}

export interface FilterPanelProps {
  sx?: Record<string, any>;
}
