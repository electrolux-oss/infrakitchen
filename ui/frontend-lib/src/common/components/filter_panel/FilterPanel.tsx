import { memo } from "react";

import { Box } from "@mui/material";

import { FilterConfig, FilterPanelProps } from "./FilterConfig";
import { useFilterContext } from "./FilterContext";
import { FilterRenderer } from "./FilterRenderer";

export const FilterPanel = memo((props: FilterPanelProps) => {
  const { sx } = props;
  const { filters, filterValues, setFilterValue } = useFilterContext();

  if (filters.length === 0) {
    return null;
  }

  return (
    <Box sx={{ width: "100%", ...sx }}>
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
