import React from "react";

import {
  Card,
  CardContent,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
} from "@mui/material";

export interface TemplateFiltersState {
  search: string;
  category: string;
  provider: string;
}

export interface TemplateFiltersProps {
  filters: TemplateFiltersState;
  categories: string[];
  providers: string[];
  onChange: (next: TemplateFiltersState) => void;
  onReset: () => void;
}

const TemplateFiltersComponent: React.FC<TemplateFiltersProps> = ({
  filters,
  categories,
  providers,
  onChange,
  onReset,
}) => {
  return (
    <Card sx={{ mb: 4 }}>
      <CardContent sx={{ pb: 2 }}>
        <Typography variant="h5" component="h3" sx={{ mb: 2 }}>
          Filters
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
          <Box sx={{ flex: "1 1 220px", minWidth: 220 }}>
            <TextField
              fullWidth
              label="Search"
              placeholder="Search templates..."
              variant="outlined"
              size="small"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              slotProps={{
                htmlInput: {
                  "aria-label": "Search templates",
                },
              }}
            />
          </Box>
          <Box sx={{ flex: "1 1 180px", minWidth: 160 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={filters.category}
                onChange={(e) =>
                  onChange({ ...filters, category: e.target.value })
                }
                inputProps={{
                  "aria-label": "Filter by category",
                }}
              >
                <MenuItem value="all">All</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: "1 1 180px", minWidth: 160 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Provider</InputLabel>
              <Select
                label="Provider"
                value={filters.provider}
                onChange={(e) =>
                  onChange({ ...filters, provider: e.target.value })
                }
                inputProps={{
                  "aria-label": "Filter by provider",
                }}
              >
                <MenuItem value="all">All</MenuItem>
                {providers.map((provider) => (
                  <MenuItem key={provider} value={provider}>
                    {provider.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: "0 0 150px" }}>
            <Button
              fullWidth
              variant="outlined"
              size="medium"
              onClick={onReset}
              sx={{ height: 40 }}
            >
              Reset Filters
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TemplateFiltersComponent;
