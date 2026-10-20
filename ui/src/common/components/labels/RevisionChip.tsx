import { MouseEvent } from "react";

import { Label, type LabelTone } from "../../../ui/Label";

export interface RevisionChipProps {
  /**
   * Revision number (rendered as `v{n}`) or a pre-formatted label such as
   * "v3" / "No revision".
   */
  revision: number | string;
  /** Opens the revision's diff. Omit (or pass undefined) to render non-interactive. */
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  tone?: LabelTone;
}

/**
 * Revision badge chip, shared by the audit log table and the revision timeline
 * so the two renderings stay consistent and change in one place.
 */
export const RevisionChip = ({
  revision,
  onClick,
  tone = "default",
}: RevisionChipProps) => {
  const clickable = typeof onClick === "function";
  const label = typeof revision === "number" ? `v${revision}` : revision;

  return (
    <Label label={label} tone={tone} clickable={clickable} onClick={onClick} />
  );
};

export default RevisionChip;
