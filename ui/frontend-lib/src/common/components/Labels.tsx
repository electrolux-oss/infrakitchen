import { FC } from "react";

import { Box, Chip, Typography } from "@mui/material";

interface LabelsProps {
  labels: string[];
}

/**
 * Renders a list of labels as chips. Displays "None" when the list is empty.
 */
export const Labels: FC<LabelsProps> = ({ labels }) => {
  if (!labels || labels.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        None
      </Typography>
    );
  }

  return (
    <Box display="flex" gap={1} flexWrap="wrap" marginTop={1} marginBottom={2}>
      {labels.map((label: string) => (
        <Chip key={label} label={label} size="small" variant="outlined" />
      ))}
    </Box>
  );
};
