import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { HeroCheckIcon, HeroMagnifyingGlassIcon } from "../../../icons";
import { Popover } from "../../../ui";
import { cn } from "../../../utils/cn";

import { FilterableField } from "./FilterConfig";

const BOTTOM_LEFT = { vertical: "bottom", horizontal: "left" } as const;
const TOP_LEFT = { vertical: "top", horizontal: "left" } as const;

// Below this many fields a search box is just noise.
const SEARCH_THRESHOLD = 7;

interface FieldPickerProps {
  anchorEl: HTMLElement | null;
  fields: FilterableField[];
  usedFields: Set<string>;
  onPick: (field: FilterableField) => void;
  onClose: () => void;
}

/** Searchable list of filterable fields; used ones are checked. */
export const FieldPicker = ({
  anchorEl,
  fields,
  usedFields,
  onPick,
  onClose,
}: FieldPickerProps) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const showSearch = fields.length >= SEARCH_THRESHOLD;

  const open = Boolean(anchorEl);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    // The popover focuses its surface first.
    const id = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? fields.filter((f) => f.label.toLowerCase().includes(q)) : fields;
  }, [query, fields]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const field = matches[Math.min(activeIndex, matches.length - 1)];
      if (field) onPick(field);
    }
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      anchorOrigin={BOTTOM_LEFT}
      transformOrigin={TOP_LEFT}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      className="mt-1 w-64 border border-divider"
    >
      {showSearch && (
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <HeroMagnifyingGlassIcon className="shrink-0 text-fg-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Filter by..."
            aria-label="Search fields"
            className="w-full min-w-0 border-0 bg-transparent p-0 text-body2 text-fg outline-none placeholder:text-fg-muted"
          />
        </div>
      )}
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Filter fields"
        className="m-0 max-h-72 list-none overflow-auto p-1"
      >
        {matches.length === 0 && (
          <li className="px-3 py-2 text-fg-muted">No matching fields</li>
        )}
        {matches.map((field, index) => {
          const used = usedFields.has(field.field);
          return (
            <li
              key={field.field}
              role="option"
              data-index={index}
              aria-selected={index === activeIndex}
              tabIndex={showSearch ? -1 : 0}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => onPick(field)}
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.preventDefault();
                  onPick(field);
                }
              }}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-2 rounded-surface px-3 py-1.5 outline-none",
                index === activeIndex && "bg-hover",
              )}
            >
              <span className="truncate">{field.label}</span>
              {used && (
                <HeroCheckIcon
                  className="shrink-0 text-primary"
                  aria-label="In use"
                />
              )}
            </li>
          );
        })}
      </ul>
    </Popover>
  );
};
