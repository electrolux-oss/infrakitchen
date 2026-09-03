import { ReactNode } from "react";

import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Grid,
  SxProps,
  Theme,
} from "@mui/material";

import { softChipColorSx, solidChipColorSx } from "../utils/softChip";

/**
 * Base layout card shared by the section cards on entity detail pages (and the
 * card-like groups on overview pages). Renders an optional header — icon,
 * name, status chip and actions — above a fixed `spacing={2}` grid that hosts
 * the caller's fields, so every card keeps a consistent structure and rhythm.
 *
 * The header is only rendered when at least one of its parts is provided;
 * a card with no header collapses straight into its content grid.
 */
export interface BaseCardProps {
  /** Card title rendered next to the icon; may be any React node. */
  name?: ReactNode;
  /** Supporting text shown under the title (header subheader). */
  description?: ReactNode;
  /** Body content, typically `<Grid item>` fields placed inside the 2-col grid. */
  children?: ReactNode;
  /** Header actions (e.g. edit / refresh buttons) rendered on the right. */
  actions?: ReactNode;
  /** Leading icon shown before the title. */
  icon?: ReactNode;
  /** Optional status text; rendered as an uppercase chip after the title. */
  chip?: string;
  /** Soft chip color; defaults to "info". */
  chipColor?:
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning";
  /** Chip style: translucent soft pill (default) or solid filled pill (EntityCard-style). */
  chipVariant?: "soft" | "solid";
  /** Style overrides merged onto the root MUI Card. */
  sx?: SxProps<Theme>;
}

export const BaseCard = (props: BaseCardProps) => {
  const {
    name,
    description,
    children,
    actions,
    icon,
    chip,
    chipColor = "info",
    chipVariant = "soft",
    sx,
  } = props;

  // Skip the header entirely unless the caller supplied at least one of its
  // pieces, so a pure content card renders without a stray empty header.
  const hasHeader = !!(name || description || actions || chip || icon);

  return (
    <Card sx={{ width: "100%", ...sx }}>
      {hasHeader && (
        <CardHeader
          title={
            // Icon + title + chip share a row; the chip sits inline after the name.
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              {icon}
              {name}
              {chip && (
                <Chip
                  label={chip.toUpperCase()}
                  variant="filled"
                  sx={
                    chipVariant === "solid"
                      ? solidChipColorSx(chipColor)
                      : softChipColorSx(chipColor)
                  }
                />
              )}
            </Box>
          }
          subheader={description ? description : undefined}
          action={actions}
          sx={{
            // Give the description breathing room below the title row.
            "& .MuiCardHeader-content": {
              "& .MuiCardHeader-subheader": {
                marginTop: 1,
              },
            },
          }}
        />
      )}
      <CardContent>
        {/* Standard 2-col grid: callers opt out of a column by passing item xs=12. */}
        <Grid container spacing={2}>
          {children}
        </Grid>
      </CardContent>
    </Card>
  );
};
