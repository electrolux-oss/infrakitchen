import { Chip } from "@mui/material";

import { solidChipColorSx } from "../../utils/softChip";

/**
 * "Abstract" badge for abstract templates. Matches the chip rendered by
 * EntityCard on the template cards, so the same template reads identically in
 * the cards grid, the wiring palette and the workflow steps.
 */
export const AbstractChip = () => (
  <Chip
    label="ABSTRACT"
    variant="filled"
    sx={(theme) => ({
      ...solidChipColorSx("info")(theme),
      height: 18,
      fontSize: "0.625rem",
    })}
  />
);

export default AbstractChip;
