import { Fragment, MouseEvent, ReactNode } from "react";

import { cn } from "../utils/cn";

import { renderCellContent } from "./cellContent";
import type {
  ColumnVisibilityModel,
  DataTableColumn,
  RowId,
} from "./DataTable.types";
import { LinearProgress, Skeleton } from "./Progress";

export interface DataCardListProps<R = any> {
  rows: readonly R[];
  columns: readonly DataTableColumn<R>[];
  getRowId?: (row: R) => RowId;
  columnVisibilityModel?: ColumnVisibilityModel;
  loading: boolean;
  skeletonCount: number;
  emptyLabel: ReactNode;
  onRowClick?: (row: R, event: MouseEvent<HTMLElement>) => void;
}

type MobileRole = NonNullable<DataTableColumn["mobile"]>;

// Columns without an explicit hint: the first non-hideable column (Name) is
// the card title, header-less columns (favorite star, action icons) sit next
// to it, everything else becomes a "Label: value" line.
const resolveRoles = <R,>(columns: DataTableColumn<R>[]) => {
  const explicitTitle = columns.find((c) => c.mobile === "title");
  const title =
    explicitTitle ??
    columns.find((c) => c.hideable === false && !c.mobile) ??
    columns.find((c) => !c.mobile && c.headerName);

  return columns.map((column): [DataTableColumn<R>, MobileRole] => {
    if (column === title) return [column, "title"];
    if (column.mobile) return [column, column.mobile];
    return [column, column.headerName ? "meta" : "badge"];
  });
};

const isEmptyValue = (value: unknown) =>
  value === null || value === undefined || value === "" || value === false;

const defaultGetRowId = (row: any): RowId => row?.id;

/** Stacked card layout for table rows on phone-width screens. */
export function DataCardList<R = any>({
  rows,
  columns,
  getRowId = defaultGetRowId,
  columnVisibilityModel,
  loading,
  skeletonCount,
  emptyLabel,
  onRowClick,
}: DataCardListProps<R>) {
  const visibleColumns = columns.filter(
    (column) =>
      column.mobile !== "hidden" &&
      columnVisibilityModel?.[column.field] !== false,
  );
  const roles = resolveRoles(visibleColumns);

  if (loading && rows.length === 0) {
    return (
      <div>
        {Array.from({ length: Math.min(skeletonCount, 5) }).map((_, index) => (
          <div
            className={cn(
              index === 0 ? "border-t-0" : "border-t",
              "border-t-divider",
              "px-4 py-3",
            )}
            key={index}
          >
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="50%" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="m-0 text-body2 text-fg-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <LinearProgress className="absolute top-0 right-0 left-0 h-0.5" />
      )}
      <div role="list">
        {rows.map((row, index) => {
          const id = getRowId(row);
          let title: ReactNode = null;
          const badges: ReactNode[] = [];
          const meta: { column: DataTableColumn<R>; value: ReactNode }[] = [];

          roles.forEach(([column, role]) => {
            const rendered = renderCellContent(column, row, id);
            const value = rendered === "" ? null : rendered;
            if (isEmptyValue(value)) return;
            if (role === "title") title = value;
            else if (role === "badge")
              badges.push(<Fragment key={column.field}>{value}</Fragment>);
            else meta.push({ column, value });
          });

          return (
            <div
              key={id ?? index}
              role="listitem"
              onClick={
                onRowClick ? (event) => onRowClick(row, event) : undefined
              }
              className={cn(
                "px-4 py-3 text-[0.875rem]",
                index > 0 && "border-t border-divider",
                onRowClick && "cursor-pointer hover:bg-primary/8",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 font-medium wrap-anywhere">
                  {title}
                </div>
                {badges.length > 0 && (
                  <div className="flex shrink-0 items-center gap-1">
                    {badges}
                  </div>
                )}
              </div>
              {meta.length > 0 && (
                <dl className="m-0 mt-2 grid grid-cols-[auto_minmax(0,_1fr)] items-center gap-x-3 gap-y-1.5">
                  {meta.map(({ column, value }) => (
                    <Fragment key={column.field}>
                      <dt className="m-0 text-caption text-fg-muted">
                        {column.headerName}
                      </dt>
                      <dd className="m-0 min-w-0 wrap-anywhere">{value}</dd>
                    </Fragment>
                  ))}
                </dl>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
