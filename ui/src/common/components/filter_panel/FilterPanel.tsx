import { memo } from "react";

import { HeroArrowPathIcon, HeroCheckIcon } from "../../../icons";
import { Button } from "../../../ui";
import { cn } from "../../../utils/cn";
import { notify } from "../../hooks/useNotification";

import { FilterConfig, FilterPanelProps } from "./FilterConfig";
import { useFilterContext } from "./FilterContext";
import { FilterRenderer } from "./FilterRenderer";

export const FilterPanel = memo((props: FilterPanelProps) => {
  const { className } = props;
  const {
    filters,
    filterValues,
    setFilterValue,
    resetFilters,
    hasActiveFilters,
    hasUnsavedFilters,
    saveFilters,
    syncToUrl,
  } = useFilterContext();

  if (filters.length === 0) {
    return null;
  }

  // Keep the empty panel compact: actions appear once there is something
  // to save or reset.
  const showActions = hasActiveFilters || hasUnsavedFilters;

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
        {showActions && (
          <div className="flex justify-end gap-2">
            {syncToUrl && saveFilters && (
              <Button
                startIcon={<HeroCheckIcon />}
                disabled={!hasUnsavedFilters}
                onClick={() => {
                  saveFilters();
                  notify("Filters saved", "success");
                }}
              >
                Save filter
              </Button>
            )}
            <Button
              startIcon={<HeroArrowPathIcon />}
              disabled={!hasActiveFilters}
              onClick={resetFilters}
            >
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

FilterPanel.displayName = "FilterPanel";
