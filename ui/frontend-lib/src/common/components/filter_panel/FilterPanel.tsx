import { memo, useEffect } from "react";

import { Box, Button, CardContent, CardHeader } from "@mui/material";
import Card from "@mui/material/Card";

import { useMultiFilterState } from "../../hooks";

import { FilterConfig, FilterPanelProps } from "./FilterConfig";
import { FilterRenderer } from "./FilterRenderer";

export const FilterPanel = memo((props: FilterPanelProps) => {
  const { filters, storageKey, onFilterChange } = props;

  const { filterValues, setFilterValue, resetFilters, hasActiveFilters } =
    useMultiFilterState({
      storageKey,
      initialValues: {},
    });

  // Notify parent of filter changes
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filterValues);
    }
  }, [filterValues, onFilterChange]);

  if (filters.length === 0) {
    return null;
  }

  return (
    <Box sx={{ width: "100%" }}>
      <Card sx={{ pb: 0 }}>
        <CardHeader
          title="Filters"
          action={
            <Button
              onClick={resetFilters}
              variant="outlined"
              disabled={!hasActiveFilters}
              size="small"
              sx={{ textTransform: "none" }}
            >
              Reset
            </Button>
          }
        />
        <CardContent>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              gap: 2,
              alignItems: "end",
              "& > *": {
                maxWidth: "550px",
              },
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
