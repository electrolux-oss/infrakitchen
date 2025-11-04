import React from "react";

import { Box, Typography, Chip } from "@mui/material";

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
        borderRadius: 1,
      }}
    >
      <Typography
        variant="body1"
        fontWeight={500}
        component="span"
        sx={{ mr: 1 }}
      >
        {output.name}
      </Typography>
      {output.source && (
        <Chip label={output.source} size="small" variant="outlined" />
      )}
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        mt={1}
      >
        {output.description || "No description"}
      </Typography>
    </Box>
  );
};
