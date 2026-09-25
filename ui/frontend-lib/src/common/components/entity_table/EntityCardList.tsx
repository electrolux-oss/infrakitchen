import { Fragment, MouseEvent, ReactNode, RefObject } from "react";

import { Box, LinearProgress, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { GridApi, GridColumnVisibilityModel } from "@mui/x-data-grid";

import type { EntityTableColumn } from "./EntityTable";

export interface EntityCardListProps {
  rows: any[];
  columns: EntityTableColumn[];
  columnVisibilityModel?: GridColumnVisibilityModel;
  loading: boolean;
  skeletonCount: number;
  emptyLabel: string;
  apiRef: RefObject<GridApi | null>;
  onRowClick?: (row: any, event: MouseEvent) => void;
}

type MobileRole = NonNullable<EntityTableColumn["mobile"]>;

// Columns without an explicit hint: the first non-hideable column (Name) is
// the card title, header-less columns (favorite star, action icons) sit next
// to it, everything else becomes a "Label: value" line.
const resolveRoles = (columns: EntityTableColumn[]) => {
  const explicitTitle = columns.find((c) => c.mobile === "title");
  const title =
    explicitTitle ??
    columns.find((c) => c.hideable === false && !c.mobile) ??
    columns.find((c) => !c.mobile && c.headerName);

  return columns.map((column): [EntityTableColumn, MobileRole] => {
    if (column === title) return [column, "title"];
    if (column.mobile) return [column, column.mobile];
    return [column, column.headerName ? "meta" : "badge"];
  });
};

const isEmptyValue = (value: unknown) =>
  value === null || value === undefined || value === "" || value === false;

// Renders one cell outside the DataGrid. Renderers in this codebase only read
// `params.row` / `params.value`, so a minimal params object is enough.
const renderValue = (
  column: EntityTableColumn,
  row: any,
  apiRef: EntityCardListProps["apiRef"],
): ReactNode => {
  const field = column.field;
  const rawValue = row?.[field];
  const value = column.valueGetter
    ? (column.valueGetter as any)(rawValue, row, column, apiRef)
    : rawValue;
  const formattedValue = column.valueFormatter
    ? (column.valueFormatter as any)(value, row, column, apiRef)
    : value;

  if (column.renderCell) {
    return column.renderCell({
      id: row.id,
      row,
      field,
      value,
      formattedValue,
      colDef: column,
    } as any);
  }
  if (isEmptyValue(formattedValue)) return null;
  return String(formattedValue);
};

export const EntityCardList = ({
  rows,
  columns,
  columnVisibilityModel,
  loading,
  skeletonCount,
  emptyLabel,
  apiRef,
  onRowClick,
}: EntityCardListProps) => {
  const visibleColumns = columns.filter(
    (column) =>
      column.mobile !== "hidden" &&
      columnVisibilityModel?.[column.field] !== false,
  );
  const roles = resolveRoles(visibleColumns);

  if (loading && rows.length === 0) {
    return (
      <Box>
        {Array.from({ length: Math.min(skeletonCount, 5) }).map((_, index) => (
          <Box
            key={index}
            sx={{
              px: 2,
              py: 1.5,
              borderTop: index === 0 ? "none" : "1px solid",
              borderTopColor: "divider",
            }}
          >
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" />
            <Skeleton variant="text" width="50%" />
          </Box>
        ))}
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: "relative" }}>
      {loading && (
        <LinearProgress
          sx={{ position: "absolute", top: 0, left: 0, right: 0, height: 2 }}
        />
      )}
      <Box role="list">
        {rows.map((row, index) => {
          let title: ReactNode = null;
          const badges: ReactNode[] = [];
          const meta: { column: EntityTableColumn; value: ReactNode }[] = [];

          roles.forEach(([column, role]) => {
            const value = renderValue(column, row, apiRef);
            if (isEmptyValue(value)) return;
            if (role === "title") title = value;
            else if (role === "badge")
              badges.push(<Fragment key={column.field}>{value}</Fragment>);
            else meta.push({ column, value });
          });

          return (
            <Box
              key={row.id ?? index}
              role="listitem"
              onClick={
                onRowClick ? (event) => onRowClick(row, event) : undefined
              }
              sx={{
                px: 2,
                py: 1.5,
                borderTop: index === 0 ? "none" : "1px solid",
                borderTopColor: "divider",
                fontSize: "0.875rem",
                ...(onRowClick && {
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: (theme) =>
                      alpha(theme.palette.primary.main, 0.08),
                  },
                }),
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: 500,
                    overflowWrap: "anywhere",
                  }}
                >
                  {title}
                </Box>
                {badges.length > 0 && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      flexShrink: 0,
                    }}
                  >
                    {badges}
                  </Box>
                )}
              </Box>
              {meta.length > 0 && (
                <Box
                  component="dl"
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr)",
                    columnGap: 1.5,
                    rowGap: 0.75,
                    alignItems: "center",
                    m: 0,
                    mt: 1,
                  }}
                >
                  {meta.map(({ column, value }) => (
                    <Fragment key={column.field}>
                      <Typography
                        component="dt"
                        variant="caption"
                        color="text.secondary"
                      >
                        {column.headerName}
                      </Typography>
                      <Box
                        component="dd"
                        sx={{ m: 0, minWidth: 0, overflowWrap: "anywhere" }}
                      >
                        {value}
                      </Box>
                    </Fragment>
                  ))}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
