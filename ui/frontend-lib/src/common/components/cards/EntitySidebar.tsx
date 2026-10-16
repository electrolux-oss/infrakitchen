import { ReactNode } from "react";

import { Box, Card, Grid, Typography } from "@mui/material";

export interface EntitySidebarLayoutProps {
  /** Main column: tabs and the rest of the page content. */
  children: ReactNode;
  sidebar: ReactNode;
}

/**
 * GitHub-style entity detail layout: content on the left, context sidebar on
 * the right; collapses to a single column (sidebar last) on small screens.
 */
export const EntitySidebarLayout = ({
  children,
  sidebar,
}: EntitySidebarLayoutProps) => (
  <Box
    sx={{
      display: "grid",
      gridTemplateColumns: {
        xs: "minmax(0, 1fr)",
        lg: "minmax(0, 1fr) 360px",
      },
      alignItems: "start",
      gap: 2,
      width: "100%",
    }}
  >
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 0,
      }}
    >
      {children}
    </Box>
    {sidebar}
  </Box>
);

export interface EntitySidebarProps {
  ariaLabel: string;
  children: ReactNode;
}

/** Sidebar card holding the SidebarSection groups of an entity detail page. */
export const EntitySidebar = ({ ariaLabel, children }: EntitySidebarProps) => (
  <Card component="aside" aria-label={ariaLabel} sx={{ p: 0 }}>
    {children}
  </Card>
);

export interface SidebarSectionProps {
  title: string;
  count?: number;
  /** Optional control rendered flush to the right of the section title. */
  action?: ReactNode;
  children: ReactNode;
}

/** Titled group of sidebar fields, separated from the next by a divider. */
export const SidebarSection = ({
  title,
  count,
  action,
  children,
}: SidebarSectionProps) => (
  <Box
    component="section"
    sx={{
      p: 2,
      "&:not(:last-of-type)": {
        borderBottom: 1,
        borderColor: "divider",
      },
    }}
  >
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        // Keep the title baseline steady whether or not an action is present.
        minHeight: 32,
        mb: 1.5,
      }}
    >
      <Typography
        component="h3"
        sx={{
          fontWeight: 600,
          fontSize: "0.875rem",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        {title}
        {count !== undefined && (
          <Box
            component="span"
            sx={{
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "text.secondary",
              bgcolor: "action.hover",
              borderRadius: "999px",
              px: 0.75,
              lineHeight: 1.6,
            }}
          >
            {count}
          </Box>
        )}
      </Typography>
      {action}
    </Box>
    <Grid container spacing={1.5}>
      {children}
    </Grid>
  </Box>
);
