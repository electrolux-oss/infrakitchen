import { MouseEvent } from "react";

import { Chip } from "@mui/material";

import { solidChipColorSx } from "../utils/softChip";

export interface RevisionChipProps {
  /**
   * Revision number (rendered as `v{n}`) or a pre-formatted label such as
   * "v3" / "No revision".
   */
  revision: number | string;
  /** Opens the revision's diff. Omit (or pass undefined) to render non-interactive. */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * "solid" — filled grey badge for dense contexts like datagrid cells
   * (audit log table). "outlined" — primary outline for the timeline header.
   */
  variant?: "solid" | "outlined";
}

/**
 * Revision badge chip, shared by the audit log table and the revision timeline
 * so the two renderings stay consistent and change in one place.
 */
export const RevisionChip = ({
  revision,
  onClick,
  variant = "solid",
}: RevisionChipProps) => {
  const clickable = typeof onClick === "function";
  const label = typeof revision === "number" ? `v${revision}` : revision;

  return (
    <Chip
      label={label}
      variant={variant === "outlined" ? "outlined" : "filled"}
      color={variant === "outlined" ? "primary" : undefined}
      sx={
        variant === "outlined"
          ? { cursor: clickable ? "pointer" : "default" }
          : (theme) => ({
              ...solidChipColorSx("default")(theme),
              cursor: clickable ? "pointer" : "default",
            })
      }
      onClick={onClick}
    />
  );
};

export default RevisionChip;
