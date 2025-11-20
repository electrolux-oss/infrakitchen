import { useEffect, useState } from "react";

import { Box, CircularProgress } from "@mui/material";

import { AutocompleteFilter, SearchFilter } from "./FilterComponents";
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
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (config.type === "autocomplete") {
      const loadOptions = async () => {
        if (typeof config.options === "function") {
          setLoading(true);
          try {
            const loadedOptions = await config.options();
            setOptions(loadedOptions);
          } catch (_) {
            setOptions([]);
          } finally {
            setLoading(false);
          }
        } else {
          setOptions(config.options);
        }
      };
      loadOptions();
    }
  }, [config]);

  const value = filterValues[config.id];
  const handleChange = (newValue: any) => {
    onChange(config.id, newValue);
  };

  const wrapperStyles = {
    width: "100%",
    display: "flex",
    alignItems: "flex-end",
  };

  switch (config.type) {
    case "search":
      return (
        <Box sx={wrapperStyles}>
          <SearchFilter config={config} value={value} onChange={handleChange} />
        </Box>
      );

    case "autocomplete":
      if (loading) {
        return (
          <Box sx={wrapperStyles}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 40,
              }}
            >
              <CircularProgress size={20} />
            </Box>
          </Box>
        );
      }
      return (
        <Box sx={wrapperStyles}>
          <AutocompleteFilter
            config={config}
            value={value}
            onChange={handleChange}
            options={options}
          />
        </Box>
      );

    default:
      return null;
  }
};
