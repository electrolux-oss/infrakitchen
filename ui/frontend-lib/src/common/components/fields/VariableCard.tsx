import React, { ReactNode } from "react";

import { Box, Chip, Grid, SxProps, Theme, Typography } from "@mui/material";

import { solidChipColorSx } from "../../utils/softChip";
import { CodeBlock } from "../code/CodeBlock";
import { InlineCode } from "../code/InlineCode";

import { PlaceholderDescription } from "./PlaceholderDescription";

export interface VariableCardProps {
  /** Variable name shown as the card heading */
  name: string;
  /** Drives the required/optional chip */
  required?: boolean;
  /** HCL type expression; multi-line types render in a code block */
  type?: string | null;
  description?: string | null;
  /** Extra chips rendered after the required/optional chip */
  chips?: ReactNode;
  /** Extra content rendered below the description in the left column */
  footer?: ReactNode;
  /** Right column content (default value, input, ...) */
  children?: ReactNode;
  sx?: SxProps<Theme>;
}

/**
 * Shared shell for the variable cards used by template version details
 * (read-only defaults) and the resource variable forms (editable inputs).
 */
export const VariableCard: React.FC<VariableCardProps> = ({
  name,
  required = false,
  type,
  description,
  chips,
  footer,
  children,
  sx,
}) => (
  <Box
    sx={[
      {
        border: 1,
        borderColor: "divider",
        p: 2,
        mb: 2,
        borderRadius: "var(--template-surface-radius)",
      },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    <Grid container sx={{ alignItems: "center" }}>
      <Grid size={{ xs: 12, md: 8 }}>
        <Typography
          variant="body1"
          component="span"
          sx={{ fontWeight: 500, mr: 1 }}
        >
          {name}
        </Typography>{" "}
        {required ? (
          <Chip label="required" sx={solidChipColorSx("error")} />
        ) : (
          <Chip label="optional" sx={solidChipColorSx("info")} />
        )}
        {chips}
        {type && (
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              mt: 1,
              gap: 1,
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Type:
            </Typography>
            {type.includes("\n") ? (
              <CodeBlock disableCopy sx={{ maxHeight: 200, maxWidth: "100%" }}>
                {type}
              </CodeBlock>
            ) : (
              <InlineCode disableCopy>{type}</InlineCode>
            )}
          </Box>
        )}
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", display: "block", mt: 1 }}
        >
          {description ? description : <PlaceholderDescription />}
        </Typography>
        {footer}
      </Grid>

      <Grid size={{ xs: 12, md: 4 }} sx={{ mt: { xs: 1, md: 0 } }}>
        {children}
      </Grid>
    </Grid>
  </Box>
);
