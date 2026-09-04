import { FC, useState } from "react";

import { Box, ClickAwayListener } from "@mui/material";

import { Label } from "./Label";
import { PlaceholderText } from "./PlaceholderDescription";

interface LabelsProps {
  labels: string[];
  /** Maximum number of labels rendered before collapsing the rest behind a "+N" chip. Pass `Infinity` to always render every label. */
  max?: number;
  /** Skip the built-in vertical margins when embedding in an already-spaced container. */
  margins?: boolean;
}

export const Labels: FC<LabelsProps> = ({
  labels,
  max = Infinity,
  margins = true,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!labels || labels.length === 0) {
    return <PlaceholderText />;
  }

  const overflow = labels.slice(max);
  const overflowCount = overflow.length;
  // Match the "99+" convention: show the exact count until it would exceed 99.
  const overflowLabel = overflowCount > 99 ? "99+" : `+${overflowCount}`;

  return (
    <ClickAwayListener onClickAway={() => setExpanded(false)}>
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
          flexWrap: "wrap",
          ...(margins && { marginTop: 1, marginBottom: 2 }),
        }}
      >
        {labels.slice(0, max).map((label) => (
          <Label key={label} label={label} />
        ))}
        {expanded &&
          overflow.map((label) => <Label key={label} label={label} />)}
        {!expanded && overflowCount > 0 && (
          <Label
            component="button"
            label={overflowLabel}
            onClick={(event) => {
              // Don't let the click reach a wrapping clickable card/page.
              event.stopPropagation();
              setExpanded(true);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            aria-expanded={false}
            aria-label={`Show all ${labels.length} labels`}
            sx={{ cursor: "pointer" }}
          />
        )}
      </Box>
    </ClickAwayListener>
  );
};
