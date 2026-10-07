import { Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

interface PlaceholderTextProps {
  /** Text to render; defaults to "Not set". */
  text?: string;
  /** Optional style overrides (e.g. to match a surrounding clamp/font size). */
  sx?: SxProps<Theme>;
}

/**
 * Muted, italic placeholder for the empty-value state (fields with no value).
 * The conventional default label is "Not set"; pass `text` for a different
 * one (e.g. the empty-description case reuses this with "No description").
 */
export const PlaceholderText = ({
  text = "Not set",
  sx,
}: PlaceholderTextProps) => (
  <Typography
    component="span"
    variant="body2"
    color="textDisabled"
    sx={{ fontStyle: "italic", ...sx }}
  >
    {text}
  </Typography>
);

interface PlaceholderDescriptionProps {
  /** Optional style overrides (e.g. to match a surrounding clamp/font size). */
  sx?: SxProps<Theme>;
}

/**
 * Muted, italic placeholder for the conventional empty-description state so it
 * reads as a placeholder rather than real content.
 */
export const PlaceholderDescription = ({ sx }: PlaceholderDescriptionProps) => (
  <PlaceholderText text="No description" sx={sx} />
);

export default PlaceholderDescription;
