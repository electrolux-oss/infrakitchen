import { useMemo } from "react";

import { Box } from "@mui/material";

import { humanizeEntityType } from "../../common/components/entities/Entity";
import { Label } from "../../common/components/labels/Label";

const AUDIT_ENTITY_TYPES = [
  "template",
  "source_code",
  "source_code_version",
  "resource",
  "executor",
  "workspace",
  "project",
  "service",
  "blueprint",
];

interface EntityTypeQuickFiltersProps {
  /** Selected entity types (`model` values); empty = no type filter. */
  selected: string[];
  onChange: (selected: string[]) => void;
}

/**
 * Toggleable chips for filtering audit logs by entity type (`model`).
 * Click a chip to include that type, click again to remove it; with none
 * selected, no type filtering is applied.
 */
export const EntityTypeQuickFilters = ({
  selected,
  onChange,
}: EntityTypeQuickFiltersProps) => {
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const sortedTypes = useMemo(
    () =>
      [...AUDIT_ENTITY_TYPES].sort((a, b) =>
        humanizeEntityType(a).localeCompare(humanizeEntityType(b)),
      ),
    [],
  );

  const toggle = (type: string) => {
    const next = new Set(selectedSet);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onChange(Array.from(next));
  };

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {sortedTypes.map((type) => (
        <Label
          key={type}
          component="button"
          label={humanizeEntityType(type)}
          onClick={(event) => {
            // Don't let the click reach a wrapping clickable container.
            event.stopPropagation();
            toggle(type);
          }}
          onKeyDown={(event) => event.stopPropagation()}
          aria-pressed={selectedSet.has(type)}
          aria-label={`Filter audit logs by ${humanizeEntityType(type)}`}
          tone={selectedSet.has(type) ? "info" : "default"}
          size="medium"
          sx={{ cursor: "pointer" }}
        />
      ))}
    </Box>
  );
};
