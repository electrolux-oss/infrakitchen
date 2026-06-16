import { Box } from "@mui/material";

const chipBoxSx = {
  display: "inline-block",
  backgroundColor: "primary.dark",
  color: "primary.contrastText",
  borderRadius: 1,
  px: 1,
  py: 0.5,
  mr: 0.5,
  mb: 0.5,
  fontSize: "0.875rem",
} as const;

export interface StringChipsProps {
  values: string[];
  format?: (value: string) => string;
}

/** Renders a list of string values as styled chips, or nothing when empty. */
export const StringChips = ({ values, format }: StringChipsProps) => {
  if (!values || values.length === 0) {
    return null;
  }
  return (
    <Box>
      {values.map((value) => (
        <Box key={value} component="span" sx={chipBoxSx}>
          {format ? format(value) : value}
        </Box>
      ))}
    </Box>
  );
};

export default StringChips;
