import React from "react";

import { CircularProgress } from "@mui/material";

interface GradientCircularProgressProps {
  size?: number;
}

export function GradientCircularProgress({
  size = 40,
}: GradientCircularProgressProps) {
  return (
    <React.Fragment>
      <svg width={0} height={0}>
        <defs>
          <linearGradient id="my_gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e01cd5" />
            <stop offset="100%" stopColor="#1CB5E0" />
          </linearGradient>
        </defs>
      </svg>
      <CircularProgress
        size={size}
        sx={{ "svg circle": { stroke: "url(#my_gradient)" } }}
      />
    </React.Fragment>
  );
}

export default GradientCircularProgress;
