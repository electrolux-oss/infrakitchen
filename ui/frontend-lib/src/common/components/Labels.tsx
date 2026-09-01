import { FC } from "react";

import { Box, Chip } from "@mui/material";

import { softChipColorSx } from "../utils/softChip";
import { PlaceholderText } from "./PlaceholderDescription";

interface LabelsProps {
  labels: string[];
  /** Compact chip size, for dense contexts like datagrid rows. */
  size?: "small" | "compact";
}

/**
 * Renders a list of labels as chips. Displays the empty-value placeholder when
 * the list is empty.
 */
export const Labels: FC<LabelsProps> = ({ labels, size = "small" }) => {
  if (!labels || labels.length === 0) {
    return <PlaceholderText />;
  }

  return (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        flexWrap: "wrap",
        marginTop: 1,
        marginBottom: 2,
      }}
    >
      {labels.map((label: string) => (
        <Chip
          key={label}
          label={label}
          size="small"
          variant="filled"
          sx={softChipColorSx("default", size === "compact")}
        />
      ))}
    </Box>
  );
};
