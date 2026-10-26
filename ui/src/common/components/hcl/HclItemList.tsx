import React, { useState, useMemo } from "react";

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from "../../../ui";
import { Label } from "../labels";

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

    const restrictedCount = items.filter((item) => item.restricted).length;
    const sensitiveCount = items.filter((item) => item.sensitive).length;

    return {
      required: requiredCount,
      restricted: restrictedCount,
      sensitive: sensitiveCount,
      optional: items.length - requiredCount,
    };
  }, [items, type]);

  if (!items || items.length === 0) {
    return (
      <p className="m-0 text-body2 text-fg-muted">
        {emptyMessage || defaultEmptyMessage}
      </p>
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
        <div className="mb-4">
          <div className="flex flex-row flex-wrap items-center justify-between gap-2">
            {/* Variable counts */}
            <div className="flex flex-row gap-2">
              {" "}
              <Label
                tone="error"
                label={`${variableCounts.required} required`}
              />
              <Label
                tone="info"
                label={`${variableCounts.optional} optional`}
              />
              <Label
                tone="warning"
                label={`${variableCounts.restricted} restricted`}
              />
              <Label
                tone="secondary"
                label={`${variableCounts.sensitive} sensitive`}
              />
            </div>

            {/* Sort dropdown - only show if more than 1 item */}
            {items.length > 1 && (
              <FormControl className="min-w-30" size="small">
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
          </div>
        </div>
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
