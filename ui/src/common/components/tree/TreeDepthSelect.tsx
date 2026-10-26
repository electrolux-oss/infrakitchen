import { MenuItem, Select } from "../../../ui";
import { cn } from "../../../utils/cn";

import { MAX_TREE_DEPTH } from "./fetchEntityTree";

export const DEFAULT_TREE_DEPTH = 3;
const DEPTH_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

interface TreeDepthSelectProps {
  value: number;
  onChange: (depth: number) => void;
  className?: string;
}

export const TreeDepthSelect = ({
  value,
  onChange,
  className,
}: TreeDepthSelectProps) => (
  <div className={cn("flex items-center gap-2", className)}>
    <label className="m-0 text-body2 text-fg-muted" htmlFor="tree-depth-select">
      Depth
    </label>
    <Select
      className="min-w-20 bg-paper"
      size="small"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      inputProps={{ id: "tree-depth-select" }}
    >
      {DEPTH_OPTIONS.map((option) => (
        <MenuItem key={option} value={option}>
          {option}
        </MenuItem>
      ))}
      <MenuItem value={MAX_TREE_DEPTH}>All</MenuItem>
    </Select>
  </div>
);
