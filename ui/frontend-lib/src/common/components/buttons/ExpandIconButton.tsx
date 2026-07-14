import { forwardRef } from "react";

import IconButton, { type IconButtonProps } from "@mui/material/IconButton";
import { styled } from "@mui/material/styles";

export type ExpandIconButtonProps = IconButtonProps & { expanded: boolean };

const StyledExpandIconButton = styled(IconButton)<{ expanded: boolean }>(
  ({ theme, expanded }) => ({
    padding: "8px 8px",
    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
    transition: theme.transitions.create("transform", {
      duration: theme.transitions.duration.shortest,
    }),
  }),
);

export const ExpandIconButton = forwardRef<
  HTMLButtonElement,
  ExpandIconButtonProps
>(function ExpandIconButton(props, ref) {
  return <StyledExpandIconButton ref={ref} {...props} />;
});
