import React from "react";

import { Box, Typography, Chip } from "@mui/material";

import { solidChipColorSx } from "../utils/softChip";
import { PlaceholderDescription } from "./PlaceholderDescription";

interface HclOutputValueProps {
  output: {
    name: string;
    description?: string;
    source?: string;
  };
}

export const HclOutputValue: React.FC<HclOutputValueProps> = ({ output }) => {
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
      <Typography
        variant="body1"
        component="span"
        sx={{
          fontWeight: 500,
          mr: 1,
        }}
      >
        {output.name}
      </Typography>
      {output.source && (
        <Chip
          label={output.source}
          size="small"
          variant="filled"
          sx={solidChipColorSx("default")}
        />
      )}
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          display: "block",
          mt: 1,
        }}
      >
        {" "}
        {output.description || (
          <PlaceholderDescription
            sx={{ fontSize: "inherit", lineHeight: "inherit" }}
          />
        )}
      </Typography>
    </Box>
  );
};
