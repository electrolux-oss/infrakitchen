import React, { useState, useMemo } from "react";

import {
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Chip,
  Stack,
} from "@mui/material";

import { HclInputVariable } from "./HclInputVariable";
import { HclOutputValue } from "./HclOutputValue";

interface HclItemListProps {
  items?: any[];
  type: "variables" | "outputs";
  emptyMessage?: string;
}

type SortBy = "name" | "required";

export const HclItemList: React.FC<HclItemListProps> = ({
  items,
  type,
  emptyMessage,
}) => {
  const [sortBy, setSortBy] = useState<SortBy>("name");

  const defaultEmptyMessage = `No ${type} found.`;

  const handleSortChange = (event: SelectChangeEvent<SortBy>) => {
    setSortBy(event.target.value as SortBy);
  };

  // Calculate required and optional counts for variables
  const variableCounts = useMemo(() => {
    if (type !== "variables" || !items || items.length === 0) {
      return { required: 0, optional: 0 };
    }

    const requiredCount = items.filter(
      (item) => item.required || item.default === undefined,
    ).length;

    return {
      required: requiredCount,
      optional: items.length - requiredCount,
    };
  }, [items, type]);

  if (!items || items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyMessage || defaultEmptyMessage}
      </Typography>
    );
  }

  const getSortedItems = (items: any[], sortBy: SortBy) => {
    if (type !== "variables") {
      // For outputs, always sort by name
      return [...items].sort((a, b) => a.name.localeCompare(b.name));
    }

    return [...items].sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);

        case "required": {
          // Required items first, then optional
          const aRequired = a.required || a.default === undefined;
          const bRequired = b.required || b.default === undefined;

          if (aRequired && !bRequired) return -1;
          if (!aRequired && bRequired) return 1;
          return a.name.localeCompare(b.name); // Secondary sort by name
        }

        default:
          return a.name.localeCompare(b.name);
      }
    });
  };

  const sortedItems = getSortedItems(items, sortBy);

  return (
    <>
      {type === "variables" && items.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={1}
          >
            {/* Variable counts */}
            <Stack direction="row" spacing={1}>
              <Chip
                label={`${variableCounts.required} required`}
                size="small"
                color="warning"
                variant="outlined"
              />
              <Chip
                label={`${variableCounts.optional} optional`}
                size="small"
                color="info"
                variant="outlined"
              />
            </Stack>

            {/* Sort dropdown - only show if more than 1 item */}
            {items.length > 1 && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Sort by</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort by"
                  onChange={handleSortChange}
                >
                  <MenuItem value="name">Name</MenuItem>
                  <MenuItem value="required">Required</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>
        </Box>
      )}

      {type === "variables" ? (
        <>
          {sortedItems.map((variable: any) => (
            <HclInputVariable key={variable.name} variable={variable} />
          ))}
        </>
      ) : (
        <>
          {sortedItems.map((output: any) => (
            <HclOutputValue key={output.name} output={output} />
          ))}
        </>
      )}
    </>
  );
};
