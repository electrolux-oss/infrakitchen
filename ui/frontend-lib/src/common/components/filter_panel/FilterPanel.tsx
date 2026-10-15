import { memo } from "react";

import { cn } from "../../../utils/cn";

import { FilterConfig, FilterPanelProps } from "./FilterConfig";
import { useFilterContext } from "./FilterContext";
import { FilterRenderer } from "./FilterRenderer";

export const FilterPanel = memo((props: FilterPanelProps) => {
  const { className } = props;
  const { filters, filterValues, setFilterValue } = useFilterContext();

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col gap-2 pb-1">
        {filters.map((config: FilterConfig) => (
          <FilterRenderer
            key={config.id}
            config={config}
            filterValues={filterValues}
            onChange={setFilterValue}
          />
        ))}
      </div>
    </div>
  );
});

FilterPanel.displayName = "FilterPanel";
