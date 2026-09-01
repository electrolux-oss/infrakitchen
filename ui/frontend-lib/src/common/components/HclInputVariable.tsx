import React from "react";

import { Box, Typography, Grid, Chip, useTheme } from "@mui/material";

import { CODE_FONT_FAMILY } from "../theme";
import { InlineCode } from "./InlineCode";
import {
  PlaceholderDescription,
  PlaceholderText,
} from "./PlaceholderDescription";
import { solidChipColorSx } from "../utils/softChip";

import { SourceConfigResponse } from "../../source_code_versions/types";
import { getValidationSummary } from "../../source_code_versions/utils/validationSummary";

type HclInputVariableData = SourceConfigResponse & {
  source?: string;
};

interface HclInputVariableProps {
  variable: HclInputVariableData;
}

export const HclInputVariable: React.FC<HclInputVariableProps> = ({
  variable,
}) => {
  const theme = useTheme();

  const validationSummary = getValidationSummary(variable);
  const formatTypeDisplay = (type: string) => {
    // If it's a simple type, display inline as mono text (not a badge)
    if (!type.includes("\n")) {
      return <InlineCode>{type}</InlineCode>;
    }

    // For complex types, display in a code block
    return (
      <Box
        component="pre"
        sx={{
          fontSize: theme.typography.caption.fontSize,
          fontFamily: CODE_FONT_FAMILY,
          margin: 0,
          p: 1,
          backgroundColor: theme.palette.action.hover,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: "var(--template-surface-radius)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflow: "auto",
          maxHeight: "200px",
          maxWidth: "100%",
        }}
      >
        {type}
      </Box>
    );
  };
  const formatDefaultValue = (defaultValue: any) => {
    if (defaultValue === undefined || defaultValue === null) {
      // No default provided — same empty-value convention as the forms.
      return <PlaceholderText />;
    }

    if (typeof defaultValue === "object") {
      const isEmptyObject = Array.isArray(defaultValue)
        ? defaultValue.length === 0
        : Object.keys(defaultValue).length === 0;

      return (
        <Box
          component="pre"
          sx={{
            fontSize: "0.75rem",
            fontFamily: CODE_FONT_FAMILY,
            margin: 0,
            whiteSpace: "pre",
            border: isEmptyObject ? "none" : "1px solid",
            borderColor: "divider",
            textAlign: isEmptyObject ? "right" : "left",
            overflow: "auto",
          }}
        >
          {JSON.stringify(defaultValue, null, 2)}
        </Box>
      );
    }

    if (typeof defaultValue === "string") {
      return <InlineCode>{`"${defaultValue}"`}</InlineCode>;
    }

    if (typeof defaultValue === "boolean") {
      return (
        <InlineCode
          sx={{ color: defaultValue ? "success.main" : "error.main" }}
        >
          {String(defaultValue)}
        </InlineCode>
      );
    }

    return <InlineCode>{String(defaultValue)}</InlineCode>;
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        p: 2,
        mb: 2,
        borderRadius: "var(--template-surface-radius)",
      }}
    >
      <Grid
        container
        sx={{
          alignItems: "center",
        }}
      >
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography
            variant="body1"
            component="span"
            sx={{
              fontWeight: 500,
              mr: 1,
            }}
          >
            {variable.name}
          </Typography>{" "}
          {variable.required ? (
            <Chip
              label="required"
              size="small"
              color="error"
              variant="filled"
              sx={solidChipColorSx("error")}
            />
          ) : (
            <Chip
              label="optional"
              size="small"
              color="info"
              variant="filled"
              sx={solidChipColorSx("info")}
            />
          )}
          {validationSummary && (
            <Chip
              label={validationSummary}
              size="small"
              color="success"
              variant="filled"
              sx={{ ml: 1, ...solidChipColorSx("success")(useTheme()) }}
            />
          )}
          {variable.restricted && (
            <Chip
              label="restricted"
              size="small"
              color="warning"
              variant="filled"
              sx={{ ml: 1, ...solidChipColorSx("warning")(useTheme()) }}
            />
          )}
          {variable.sensitive && (
            <Chip
              label="sensitive"
              size="small"
              color="secondary"
              variant="filled"
              sx={{ ml: 1, ...solidChipColorSx("secondary")(useTheme()) }}
            />
          )}
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-start",
              mt: 1,
              gap: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
              }}
            >
              Type:
            </Typography>
            {formatTypeDisplay(variable.type)}
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              display: "block",
              mt: 1,
            }}
          >
            {variable.description ? variable.description : <PlaceholderDescription />}
          </Typography>
          {variable.source && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "block",
                mt: 0.5,
              }}
            >
              source: {variable.source}
            </Typography>
          )}
        </Grid>

        <Grid
          size={{ xs: 12, md: 4 }}
          sx={{
            textAlign: { md: "right" },
            mt: { xs: 1, md: 0 },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
            }}
          >
            Default
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
            }}
          >
            {formatDefaultValue(variable.default)}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};
