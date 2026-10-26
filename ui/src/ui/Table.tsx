import {
  createContext,
  HTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
  useContext,
} from "react";

import { cn } from "../utils/cn";

const TableSizeContext = createContext<"small" | "medium">("medium");
const TableStickyContext = createContext(false);
const TableHeadContext = createContext(false);

export function TableContainer({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full overflow-x-auto", className)} {...rest} />;
}

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  size?: "small" | "medium";
  /** Keep the header row visible while the container scrolls. */
  stickyHeader?: boolean;
}

/** Static table (daisyUI `table`); see DataTable for sorting and paging. */
export function Table({
  size = "medium",
  stickyHeader = false,
  className,
  ...rest
}: TableProps) {
  return (
    <TableSizeContext.Provider value={size}>
      <TableStickyContext.Provider value={stickyHeader}>
        <table
          className={cn(
            "d-table w-full border-collapse rounded-none text-body2",
            className,
          )}
          {...rest}
        />
      </TableStickyContext.Provider>
    </TableSizeContext.Provider>
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <TableHeadContext.Provider value={true}>
      <thead {...props} />
    </TableHeadContext.Provider>
  );
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  hover?: boolean;
}

export function TableRow({ hover = false, className, ...rest }: TableRowProps) {
  return (
    <tr
      className={cn("border-0", hover && "hover:bg-hover", className)}
      {...rest}
    />
  );
}

export interface TableCellProps extends Omit<
  TdHTMLAttributes<HTMLTableCellElement>,
  "align"
> {
  align?: "left" | "center" | "right" | "inherit" | "justify";
  /** Render as th (row headers) or td regardless of section. */
  component?: "th" | "td";
  scope?: ThHTMLAttributes<HTMLTableCellElement>["scope"];
}

export function TableCell({
  align,
  component,
  className,
  ...rest
}: TableCellProps) {
  const size = useContext(TableSizeContext);
  const sticky = useContext(TableStickyContext);
  const inHead = useContext(TableHeadContext);
  const Cell = component ?? (inHead ? "th" : "td");
  return (
    <Cell
      className={cn(
        "border-b border-divider text-left align-middle",
        !inHead && "text-body2 text-fg",
        size === "small" ? "px-4 py-1.5" : "p-4",
        Cell === "th" && !inHead && "font-normal",
        inHead && sticky && "sticky top-0 z-[2] bg-paper",
        align === "center" && "text-center",
        align === "right" && "text-right",
        align === "justify" && "text-justify",
        className,
      )}
      {...rest}
    />
  );
}
