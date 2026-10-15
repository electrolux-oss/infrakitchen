import { MouseEvent } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "../icons/material";
import { cn } from "../utils/cn";

import { BUTTON_BASE } from "./Button";
import { MenuItem } from "./Menu";
import { Select } from "./Select";

export interface PaginationProps {
  count: number;
  /** 1-based page. */
  page: number;
  onChange?: (event: MouseEvent<HTMLButtonElement>, page: number) => void;
  siblingCount?: number;
  size?: "small" | "medium";
  className?: string;
}

function pageItems(count: number, page: number, siblings: number) {
  const items: (number | "gap")[] = [];
  const start = Math.max(2, page - siblings);
  const end = Math.min(count - 1, page + siblings);
  items.push(1);
  if (start > 2) items.push("gap");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < count - 1) items.push("gap");
  if (count > 1) items.push(count);
  return items;
}

/** Page buttons (daisyUI `join`). */
export function Pagination({
  count,
  page,
  onChange,
  siblingCount = 1,
  size = "medium",
  className,
}: PaginationProps) {
  const itemClass = cn(
    BUTTON_BASE,
    "mx-px min-h-0 min-w-0 rounded-full border-0 bg-transparent px-1 font-normal text-fg hover:bg-hover disabled:bg-transparent disabled:text-disabled",
    size === "small"
      ? "h-[26px] min-w-[26px] text-[0.8125rem]"
      : "h-8 min-w-8 text-body2",
  );
  return (
    <nav aria-label="pagination" className={cn("flex items-center", className)}>
      <button
        type="button"
        aria-label="Go to previous page"
        className={itemClass}
        disabled={page <= 1}
        onClick={(event) => onChange?.(event, page - 1)}
      >
        <ChevronLeftIcon fontSize="small" />
      </button>
      {pageItems(count, page, siblingCount).map((item, index) =>
        item === "gap" ? (
          <span
            key={`gap-${index}`}
            className="min-w-[26px] text-center text-fg"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-current={item === page ? "page" : undefined}
            aria-label={`page ${item}`}
            className={cn(
              itemClass,
              item === page && "bg-selected hover:bg-selected",
            )}
            onClick={(event) => item !== page && onChange?.(event, item)}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Go to next page"
        className={itemClass}
        disabled={page >= count}
        onClick={(event) => onChange?.(event, page + 1)}
      >
        <ChevronRightIcon fontSize="small" />
      </button>
    </nav>
  );
}

export interface TablePaginationProps {
  count: number;
  /** 0-based page. */
  page: number;
  onPageChange: (event: MouseEvent<HTMLButtonElement>, page: number) => void;
  rowsPerPage: number;
  onRowsPerPageChange?: (event: { target: { value: string } }) => void;
  rowsPerPageOptions?: number[];
  className?: string;
}

/** "Rows per page" selector plus range and prev/next arrows for tables. */
export function TablePagination({
  count,
  page,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  rowsPerPageOptions = [10, 25, 50, 100],
  className,
}: TablePaginationProps) {
  const from = count === 0 ? 0 : page * rowsPerPage + 1;
  const to = Math.min(count, (page + 1) * rowsPerPage);
  const lastPage = Math.max(0, Math.ceil(count / rowsPerPage) - 1);
  const arrow = cn(
    BUTTON_BASE,
    "size-9 min-h-0 border-0 bg-transparent p-1 text-fg-muted hover:bg-hover disabled:bg-transparent disabled:text-disabled",
  );
  return (
    <div
      className={cn(
        "flex min-h-[52px] flex-wrap items-center justify-end gap-x-6 gap-y-1 px-2 text-body2 text-fg",
        className,
      )}
    >
      {onRowsPerPageChange && rowsPerPageOptions.length > 1 && (
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <Select
            variant="standard"
            value={rowsPerPage}
            aria-label="Rows per page"
            onChange={(event) =>
              onRowsPerPageChange({
                target: { value: String(event.target.value) },
              })
            }
          >
            {rowsPerPageOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </div>
      )}
      <span>
        {from}–{to} of {count}
      </span>
      <div className="flex items-center">
        <button
          type="button"
          aria-label="Go to previous page"
          className={arrow}
          disabled={page === 0}
          onClick={(event) => onPageChange(event, page - 1)}
        >
          <ChevronLeftIcon fontSize="small" />
        </button>
        <button
          type="button"
          aria-label="Go to next page"
          className={arrow}
          disabled={page >= lastPage}
          onClick={(event) => onPageChange(event, page + 1)}
        >
          <ChevronRightIcon fontSize="small" />
        </button>
      </div>
    </div>
  );
}
