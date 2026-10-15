import { Chip } from "../../../ui";

/**
 * "Abstract" badge for abstract templates. Matches the chip rendered by
 * EntityCard on the template cards, so the same template reads identically in
 * the cards grid, the wiring palette and the workflow steps.
 */
export const AbstractChip = () => (
  <Chip
    label="ABSTRACT"
    variant="filled"
    className="h-4.5 text-[0.625rem]"
    appearance="solid"
    color="info"
  />
);

export default AbstractChip;
