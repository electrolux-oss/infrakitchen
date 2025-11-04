import {
  Autocomplete,
  Box,
  Button,
  CardContent,
  CardHeader,
  Chip,
  TextField,
} from "@mui/material";
import Card from "@mui/material/Card";

import { useFilterState } from "../hooks";

interface FilterPanelProps {
  dropdownOptions: string[];
  filterName?: string;
  searchName?: string;
  filterStorageKey: string;
}

export const CONTROL_HEIGHT = 40;

export const inputBaseHeightStyles = {
  height: CONTROL_HEIGHT,
  boxSizing: "border-box",
  padding: 0,
  alignItems: "center",
};

export const FilterPanel = ({
  dropdownOptions = [],
  filterName,
  searchName,
  filterStorageKey,
}: FilterPanelProps) => {
  const { search, setSearch, selectedFilters, setSelectedFilters } =
    useFilterState({
      storageKey: filterStorageKey,
    });

  const handleReset = () => {
    setSearch("");
    setSelectedFilters([]);
  };

  const disabled = search === "" && selectedFilters.length === 0;

  return (
    <Box sx={{ width: "100%" }}>
      <Card sx={{ pb: 0 }}>
        <CardHeader title="Filters" />
        <CardContent>
          <Box sx={{ width: "100%" }}>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              {searchName && (
                <Box
                  sx={{
                    flex: "0 0 420px",
                    width: 420,
                    maxWidth: "100%",
                    display: "flex",
                    alignItems: "flex-end",
                  }}
                >
                  <TextField
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    label="Search"
                    size="small"
                    slotProps={{ input: { spellCheck: false } }}
                    sx={{
                      width: "100%",
                      "& .MuiInputBase-root": {
                        ...inputBaseHeightStyles,
                      },
                      "& .MuiOutlinedInput-input": {
                        pl: 1,
                      },
                    }}
                  />
                </Box>
              )}
              {filterName && (
                <Box
                  sx={{
                    flex: "0 0 420px",
                    width: 420,
                    maxWidth: "100%",
                    display: "flex",
                    alignItems: "flex-end",
                  }}
                >
                  <Autocomplete
                    multiple
                    options={dropdownOptions}
                    value={selectedFilters}
                    onChange={(_, value) => setSelectedFilters(value)}
                    disableCloseOnSelect
                    filterSelectedOptions
                    size="small"
                    renderValue={(value, getTagProps) => {
                      const maxToShow = 3;
                      const visible = value.slice(0, maxToShow);
                      return [
                        ...visible.map((option, index) => (
                          <Chip
                            label={option}
                            {...getTagProps({ index })}
                            key={option}
                            size="small"
                            variant="outlined"
                          />
                        )),
                        value.length > maxToShow ? (
                          <Chip
                            label={`+${value.length - maxToShow}`}
                            {...getTagProps({ index: maxToShow })}
                            key="more"
                            size="small"
                            variant="outlined"
                          />
                        ) : null,
                      ];
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={`${filterName.charAt(0).toUpperCase()}${filterName.slice(1)}`}
                        sx={{
                          "& .MuiInputBase-root": {
                            ...inputBaseHeightStyles,
                          },
                        }}
                      />
                    )}
                    sx={{
                      width: "100%",
                      "& .MuiAutocomplete-inputRoot": {
                        ...inputBaseHeightStyles,
                        flexWrap: "nowrap",
                        overflow: "hidden",
                      },
                      "& .MuiChip-root": {
                        maxWidth: 90,
                        "& .MuiChip-label": {
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        },
                      },
                    }}
                  />
                </Box>
              )}
              <Box
                sx={{
                  flex: "1 1 auto",
                  minWidth: 160,
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <Button
                  onClick={handleReset}
                  variant="outlined"
                  disabled={disabled}
                  size="small"
                  sx={{
                    flex: 1,
                    whiteSpace: "nowrap",
                    alignSelf: "flex-start",
                    boxSizing: "border-box",
                    height: CONTROL_HEIGHT,
                  }}
                >
                  Reset filters
                </Button>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};
