import { cn } from "../../../utils/cn";

interface PlaceholderTextProps {
  /** Text to render; defaults to "Not set". */
  text?: string;
  /** Optional class overrides (e.g. to match a surrounding clamp/font size). */
  className?: string;
}

/**
 * Muted, italic placeholder for the empty-value state (fields with no value).
 * The conventional default label is "Not set"; pass `text` for a different
 * one (e.g. the empty-description case reuses this with "No description").
 */
export const PlaceholderText = ({
  text = "Not set",
  className,
}: PlaceholderTextProps) => (
  <span className={cn("text-body2 text-fg-disabled italic", className)}>
    {text}
  </span>
);

interface PlaceholderDescriptionProps {
  /** Optional class overrides (e.g. to match a surrounding clamp/font size). */
  className?: string;
}

/**
 * Muted, italic placeholder for the conventional empty-description state so it
 * reads as a placeholder rather than real content.
 */
export const PlaceholderDescription = ({
  className,
}: PlaceholderDescriptionProps) => (
  <PlaceholderText text="No description" className={className} />
);
