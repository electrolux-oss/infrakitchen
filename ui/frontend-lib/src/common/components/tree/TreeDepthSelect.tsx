import {
  Box,
  MenuItem,
  Select,
  SxProps,
  Theme,
  Typography,
} from "@mui/material";

import { MAX_TREE_DEPTH } from "./fetchEntityTree";

export const DEFAULT_TREE_DEPTH = 3;
const DEPTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface TreeDepthSelectProps {
  value: number;
  onChange: (depth: number) => void;
  sx?: SxProps<Theme>;
}

export const TreeDepthSelect = ({
  value,
  onChange,
  sx,
}: TreeDepthSelectProps) => (
  <Box
    sx={[
      { display: "flex", alignItems: "center", gap: 1 },
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    <Typography
      component="label"
      htmlFor="tree-depth-select"
      variant="body2"
      sx={{ color: "text.secondary" }}
    >
      Depth
    </Typography>
    <Select
      size="small"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      inputProps={{ id: "tree-depth-select" }}
      sx={{ minWidth: 80, bgcolor: "background.paper" }}
    >
      {DEPTH_OPTIONS.map((option) => (
        <MenuItem key={option} value={option}>
          {option}
        </MenuItem>
      ))}
      <MenuItem value={MAX_TREE_DEPTH}>All</MenuItem>
    </Select>
  </Box>
);
