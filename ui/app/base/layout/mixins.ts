import { type Theme } from "@mui/material/styles";

export function getDrawerSxTransitionMixin(
  isExpanded: boolean,
  property: string,
) {
  return {
    transition: (theme: Theme) =>
      theme.transitions.create(property, {
        easing: theme.transitions.easing.sharp,
        duration: isExpanded
          ? theme.transitions.duration.enteringScreen
          : theme.transitions.duration.leavingScreen,
      }),
  };
}

export function getDrawerWidthTransitionMixin(isExpanded: boolean) {
  return {
    ...getDrawerSxTransitionMixin(isExpanded, "width"),
    overflowX: "hidden",
  };
}

/**
 * Subtle neutral pill style shared by the header version chip and the sidebar
 * "alpha"/"beta" label: light gray fill, secondary text, thin divider border.
 * `sx` is an object (not a callback) so it can be spread into an sx prop.
 */
export const neutralPillSx = {
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap",
  fontSize: "0.68rem",
  fontWeight: 500,
  lineHeight: 1,
  color: "text.secondary",
  borderRadius: "999px",
  border: "1px solid",
  borderColor: "divider",
  backgroundColor: "action.hover",
  padding: "4px 9px",
} as const;
