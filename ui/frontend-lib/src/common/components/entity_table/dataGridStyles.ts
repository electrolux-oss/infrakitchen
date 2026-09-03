import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

// Centralized "flush" table styling for MUI DataGrid.
// Every entity table shares this one definition instead of inlining ad-hoc sx.
export const dataGridSx: SystemStyleObject<Theme> = {
  // Header: muted labels over a single hairline, no heavy header bar.
  "& .MuiDataGrid-columnHeaders": {
    backgroundColor: "transparent",
    borderBottom: "1px solid",
    borderBottomColor: "divider",
  },
  "& .MuiDataGrid-columnHeader": {
    backgroundColor: "transparent",
    "&.MuiDataGrid-columnHeader--sortable:hover": {
      backgroundColor: "transparent",
    },
    "& .MuiDataGrid-columnHeaderTitleContainer": {
      justifyContent: "space-between",
      flexDirection: "row",
      lineHeight: 1.2,
    },
    "& .MuiDataGrid-columnHeaderTitle": {
      fontWeight: 500,
      fontSize: "0.8125rem",
      color: "text.secondary",
    },
    "& .MuiButtonBase-root": {
      border: "none",
    },
  },
  // No vertical separators between headers.
  "& .MuiDataGrid-columnSeparator": {
    display: "none",
  },
  // Rows are neutral by default: grids whose rows actually navigate (or opt in
  // via `dataGridClickableRowSx`) get the pointer + hover affordance.
  "& .MuiDataGrid-row": {
    "&:hover": {
      backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.03),
    },
  }, // One canonical font size for every field's text in the table. DataGrid v9
  // draws the row separators as a hairline above each cell (cell border-top via
  // a palette CSS var), so we pin an explicit divider color here instead of
  // relying on the grid's var-based default, which can resolve to nothing in
  // some themes.
  "& .MuiDataGrid-cell": {
    fontSize: "0.875rem",
    alignItems: "flex-start",
    borderTop: "1px solid",
    borderTopColor: "divider",
    py: "10px",
    // No focus ring on mouse click (reads as noisy "selection"); a subtle
    // ring stays for keyboard navigation via :focus-visible.
    "&:focus": {
      outline: "none",
    },
    "&:focus-within": {
      outline: "none",
    },
    "&:focus-visible": {
      outline: "2px solid",
      outlineColor: "primary.main",
      outlineOffset: "-2px",
    },
  },
  // Keep the gap under the header hairline: the first row's top line is
  // redundant with the header's own bottom border.
  "& .MuiDataGrid-row--firstVisible .MuiDataGrid-cell": {
    borderTopColor: "transparent",
  },
  "& .MuiDataGrid-cellContent": {
    whiteSpace: "normal",
    overflow: "visible",
    textOverflow: "clip",
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  // Floor the grid height so empty or sparsely populated tables still fill a
  // respectable footprint (the "No rows" overlay expands instead of huddling
  // at the top). Embedded grids that intentionally hug their content
  // (autoHeight, compact read-only tables) reset this with minHeight: "auto".
  minHeight: 380,
  // Footer: keep the flush control look (no focus boxes/swallows), default
  // MUI heights.
  "& .MuiDataGrid-footerContainer": {
    borderTop: "1px solid",
    borderTopColor: "divider",
  },
  "& .MuiTablePagination-root": {
    "& .MuiButtonBase-root": {
      border: "none",
    },
    // MUI's standard select gives the Rows-per-page value asymmetric vertical
    // padding (1px top / 5px bottom), which parks the current value ~2px high
    // against the "Rows per page:" label. Rebalance so the text centers.
    "& .MuiTablePagination-select": {
      paddingTop: "3px",
      paddingBottom: "3px",
    },
  },
};

// Opt-in affordance for grids whose rows navigate somewhere (detail pages,
// audit history, ...): pointer cursor + a slightly stronger hover tint.
export const dataGridClickableRowSx = {
  "& .MuiDataGrid-row": {
    cursor: "pointer",
    "&:hover": {
      backgroundColor: (theme: Theme) =>
        alpha(theme.palette.primary.main, 0.08),
    },
  },
} as const;

// Shared pagination slotProps: consistent "Rows per page" labeling (aria + id)
// across every grid. Callers pass a unique labelId so multiple grids on one
// page keep valid aria-labelledby associations.
export const dataGridPaginationSlotProps = (labelId: string) =>
  ({
    pagination: {
      SelectProps: {
        inputProps: {
          "aria-label": "Rows per page",
          "aria-labelledby": labelId,
        },
        "aria-label": "Rows per page",
      },
      labelRowsPerPage: "Rows per page:",
      labelId,
    },
  }) as const;

// Defaults every DataGrid in the app should share.
export const dataGridDefaultProps = {
  disableColumnFilter: true,
  disableColumnSelector: true,
  disableDensitySelector: true,
  // Column sorting is available via the header sort icons, so the "More"
  // column-menu button (which would only duplicate the sort actions) is hidden.
  disableColumnMenu: true,
  getRowHeight: () => "auto" as const,
  // Friendlier empty states than the terse MUI "No rows" / "No results" —
  // one covers a table with no records at all, the other a filtered view
  // whose filters matched nothing.
  localeText: {
    noRowsLabel: "No Results Found",
    noResultsOverlayLabel: "No Results Found",
  },
};
