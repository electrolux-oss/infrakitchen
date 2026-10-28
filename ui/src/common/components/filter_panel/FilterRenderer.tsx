import { ReactNode, useCallback } from "react";

import { FilterBar } from "./FilterBar";
import { FilterClause, FilterConfig, FilterState } from "./FilterConfig";

interface FilterRendererProps {
  config: FilterConfig;
  filterValues: FilterState;
  onChange: (filterId: string, value: any) => void;
  /** Extra controls at the end of the bar. */
  trailing?: ReactNode;
}

const NO_CLAUSES: FilterClause[] = [];

export const FilterRenderer = ({
  config,
  filterValues,
  onChange,
  trailing,
}: FilterRendererProps) => {
  const value = filterValues[config.id];
  const handleChange = useCallback(
    (newValue: FilterClause[]) => onChange(config.id, newValue),
    [config.id, onChange],
  );

  return (
    <FilterBar
      config={config}
      value={Array.isArray(value) ? value : NO_CLAUSES}
      onChange={handleChange}
      trailing={trailing}
    />
  );
};
