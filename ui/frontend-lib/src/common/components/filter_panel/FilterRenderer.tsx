import { Box } from "@mui/material";

import { AdvancedFilter } from "./AdvancedFilter";
import { FilterConfig, FilterState } from "./FilterConfig";

interface FilterRendererProps {
  config: FilterConfig;
  filterValues: FilterState;
  onChange: (filterId: string, value: any) => void;
}

export const FilterRenderer = ({
  config,
  filterValues,
  onChange,
}: FilterRendererProps) => {
  const value = filterValues[config.id];
  const handleChange = (newValue: any) => {
    onChange(config.id, newValue);
  };

  const wrapperStyles = {
    width: "100%",
    display: "flex",
    alignItems: "flex-end",
  };

  return (
    <Box sx={{ ...wrapperStyles, alignItems: "flex-start" }}>
      <AdvancedFilter
        config={config}
        value={value || []}
        onChange={handleChange}
      />
    </Box>
  );
};
