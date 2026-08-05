import { memo } from "react";

import SaveIcon from "@mui/icons-material/Save";
import { Box, Button, CardContent, CardHeader } from "@mui/material";
import Card from "@mui/material/Card";

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
      <Card sx={{ pb: 0 }}>
        <CardHeader
          title="Filters"
          action={
            <Box sx={{ display: "flex", gap: 1 }}>
              {syncToUrl && saveFilters && (
                <Button
                  onClick={() => {
                    saveFilters();
                    notify("Filters saved", "success");
                  }}
                  variant="outlined"
                  disabled={!hasUnsavedFilters}
                  size="small"
                  startIcon={<SaveIcon />}
                  sx={{ textTransform: "none" }}
                >
                  Save filter
                </Button>
              )}
              <Button
                onClick={resetFilters}
                variant="outlined"
                disabled={!hasActiveFilters}
                size="small"
                sx={{ textTransform: "none" }}
              >
                Reset
              </Button>
            </Box>
          }
        />
        <CardContent>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
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
        </CardContent>
      </Card>
    </Box>
  );
});

FilterPanel.displayName = "FilterPanel";
