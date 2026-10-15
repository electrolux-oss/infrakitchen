import IconButton from "@mui/material/IconButton";
import { styled } from "@mui/material/styles";

export const ExpandIconButton = styled(IconButton)<{ expanded: boolean }>(
  ({ theme, expanded }) => ({
    padding: "8px 8px",
    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
    transition: theme.transitions.create("transform", {
      duration: theme.transitions.duration.shortest,
    }),
  }),
);
