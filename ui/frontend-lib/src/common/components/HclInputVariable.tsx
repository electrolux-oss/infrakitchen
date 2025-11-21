import React from "react";

import { Box, Typography, Grid, Chip, useTheme } from "@mui/material";

interface HclInputVariableProps {
  variable: {
    name: string;
    type: string;
    original_type?: string;
    description?: string;
    required?: boolean;
    restricted?: boolean;
    sensitive?: boolean;
    default?: any;
    source?: string;
  };
}

export const HclInputVariable: React.FC<HclInputVariableProps> = ({
  variable,
}) => {
  const theme = useTheme();

  const formatTypeDisplay = (type: string) => {
    // If it's a simple type, display inline
    if (!type.includes("\n")) {
      return <Chip label={type} size="small" variant="outlined" />;
    }

    // For complex types, display in a code block
    return (
      <Box
        component="pre"
        sx={{
          fontSize: theme.typography.caption.fontSize,
          margin: 0,
          p: 1,
          backgroundColor: theme.palette.action.hover,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1.5,
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
      return "null";
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
      return (
        <Box
          component="code"
          sx={{
            fontSize: "0.75rem",
          }}
        >
          {`"${defaultValue}"`}
        </Box>
      );
    }

    if (typeof defaultValue === "boolean") {
      return (
        <Box
          component="code"
          sx={{
            fontSize: "0.75rem",
            color: defaultValue ? "success.main" : "error.main",
          }}
        >
          {String(defaultValue)}
        </Box>
      );
    }

    return String(defaultValue);
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        p: 2,
        mb: 2,
        borderRadius: 1,
      }}
    >
      <Grid container alignItems="center">
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography
            variant="body1"
            fontWeight={500}
            component="span"
            sx={{ mr: 1 }}
          >
            {variable.name}
          </Typography>

          {variable.required ? (
            <Chip
              label="required"
              size="small"
              color="warning"
              variant="outlined"
            />
          ) : (
            <Chip
              label="optional"
              size="small"
              color="info"
              variant="outlined"
            />
          )}

          {variable.restricted && (
            <Chip
              label="restricted"
              size="small"
              color="error"
              variant="outlined"
              sx={{ ml: 1 }}
            />
          )}

          {variable.sensitive && (
            <Chip
              label="sensitive"
              size="small"
              color="secondary"
              variant="outlined"
              sx={{ ml: 1 }}
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
            <Typography variant="caption" color="text.secondary">
              Type:
            </Typography>
            {formatTypeDisplay(variable.original_type || variable.type)}
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            mt={1}
          >
            {variable.description || "No description"}
          </Typography>

          {variable.source && (
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              mt={0.5}
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
          <Typography variant="caption" color="text.secondary">
            Default
          </Typography>
          <Typography variant="body2" fontWeight={500}>
            {formatDefaultValue(variable.default)}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};
