import { memo } from "react";

import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import { Box, IconButton, Tooltip } from "@mui/material";

import { notify } from "../../hooks/useNotification";

import { FilterConfig, FilterPanelProps } from "./FilterConfig";
import { useFilterContext } from "./FilterContext";
import { FilterRenderer } from "./FilterRenderer";

export const FilterPanel = memo((props: FilterPanelProps) => {
  const { sx } = props;
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

  return (
    <Box sx={{ width: "100%", ...sx }}>
      {hasActiveFilters && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0.5,
            mb: 1,
          }}
        >
          {syncToUrl && saveFilters && (
            <Tooltip title="Save filter" disableInteractive>
              <span>
                <IconButton
                  aria-label="Save filter"
                  onClick={() => {
                    saveFilters();
                    notify("Filters saved", "success");
                  }}
                  disabled={!hasUnsavedFilters}
                  size="small"
                  sx={{
                    color: hasUnsavedFilters
                      ? "text.primary"
                      : "text.secondary",
                    border: "none",
                    backgroundColor: "transparent",
                  }}
                >
                  <SaveIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title="Reset filters" disableInteractive>
            <span>
              <IconButton
                aria-label="Reset filters"
                onClick={resetFilters}
                size="small"
                sx={{
                  color: "text.secondary",
                  border: "none",
                  backgroundColor: "transparent",
                }}
              >
                <RestartAltIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          pb: 0.5,
        }}
      >
        {filters.map((config: FilterConfig) => (
          <FilterRenderer
            key={config.id}
            config={config}
            filterValues={filterValues}
            onChange={setFilterValue}
          />
        ))}
      </Box>
    </Box>
  );
});

FilterPanel.displayName = "FilterPanel";
