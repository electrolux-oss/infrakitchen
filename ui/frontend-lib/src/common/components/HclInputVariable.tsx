import React from "react";

import { Box, Typography, Grid, Chip, useTheme } from "@mui/material";

import { CodeBlock } from "./CodeBlock";
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
  const validationSummary = getValidationSummary(variable);
  const formatTypeDisplay = (type: string) => {
    // If it's a simple type, display inline as mono text (not a badge)
    if (!type.includes("\n")) {
      return <InlineCode disableCopy>{type}</InlineCode>;
    }

    // For complex types, display in a code block
    return (
      <CodeBlock disableCopy sx={{ maxHeight: 200, maxWidth: "100%" }}>
        {type}
      </CodeBlock>
    );
  };
  const formatDefaultValue = (defaultValue: any) => {
    if (defaultValue === undefined || defaultValue === null) {
      // No default provided — same empty-value convention as the forms.
      return <PlaceholderText />;
    }

    if (typeof defaultValue === "object") {
      return <CodeBlock>{JSON.stringify(defaultValue, null, 2)}</CodeBlock>;
    }

    if (typeof defaultValue === "string") {
      return <CodeBlock>{defaultValue}</CodeBlock>;
    }

    if (typeof defaultValue === "boolean") {
      return (
        <CodeBlock sx={{ color: defaultValue ? "success.main" : "error.main" }}>
          {String(defaultValue)}
        </CodeBlock>
      );
    }

    return <CodeBlock>{String(defaultValue)}</CodeBlock>;
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
              color="error"
              variant="filled"
              sx={solidChipColorSx("error")}
            />
          ) : (
            <Chip
              label="optional"
              color="info"
              variant="filled"
              sx={solidChipColorSx("info")}
            />
          )}
          {validationSummary && (
            <Chip
              label={validationSummary}
              color="success"
              variant="filled"
              sx={{ ml: 1, ...solidChipColorSx("success")(useTheme()) }}
            />
          )}
          {variable.restricted && (
            <Chip
              label="restricted"
              color="warning"
              variant="filled"
              sx={{ ml: 1, ...solidChipColorSx("warning")(useTheme()) }}
            />
          )}
          {variable.sensitive && (
            <Chip
              label="sensitive"
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
            {variable.description ? (
              variable.description
            ) : (
              <PlaceholderDescription />
            )}
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
            textAlign: "left",
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
