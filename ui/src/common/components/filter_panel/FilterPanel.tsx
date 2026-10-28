import { memo } from "react";

import { Button, Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";
import { notify } from "../../hooks/useNotification";

import { FilterPanelProps } from "./FilterConfig";
import { useFilterContext } from "./FilterContext";
import { FilterRenderer } from "./FilterRenderer";

/**
 * Saved view controls (URL-synced pages only). A saved view is the set of
 * filters the page opens with when the URL has none.
 */
const SavedViewActions = () => {
  const {
    hasActiveFilters,
    hasUnsavedFilters,
    hasSavedFilters,
    isSavedView,
    saveFilters,
    applySavedFilters,
    clearSavedFilters,
    resetFilters,
  } = useFilterContext();

  if (!saveFilters) return null;

  if (isSavedView) {
    return (
      <>
        <span className="text-body2 text-fg-muted">Saved view</span>
        <Tooltip title="Delete the saved view and clear all filters">
          <Button
            variant="text"
            color="inherit"
            onClick={() => {
              clearSavedFilters?.();
              resetFilters();
              notify("Saved view removed", "success");
            }}
          >
            Remove
          </Button>
        </Tooltip>
      </>
    );
  }

  return (
    <>
      {hasSavedFilters && (
        <Tooltip title="Go back to the filters this page opens with">
          <Button variant="text" color="inherit" onClick={applySavedFilters}>
            Restore saved view
          </Button>
        </Tooltip>
      )}
      {hasActiveFilters && hasUnsavedFilters && (
        <Tooltip title="Open this page with these filters by default">
          <Button
            variant="text"
            onClick={() => {
              saveFilters();
              notify("View saved", "success");
            }}
          >
            Save view
          </Button>
        </Tooltip>
      )}
    </>
  );
};

export const FilterPanel = memo((props: FilterPanelProps) => {
  const { className } = props;
  const { filters, filterValues, setFilterValue } = useFilterContext();

  if (filters.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex w-full flex-col gap-2 pb-1", className)}>
      {filters.map((config, index) => (
        <FilterRenderer
          key={config.id}
          config={config}
          filterValues={filterValues}
          onChange={setFilterValue}
          trailing={index === filters.length - 1 ? <SavedViewActions /> : null}
        />
      ))}
    </div>
  );
});

FilterPanel.displayName = "FilterPanel";
