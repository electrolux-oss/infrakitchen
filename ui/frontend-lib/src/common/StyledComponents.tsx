import { forwardRef } from "react";

import { Tab, type TabProps } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledTabRoot = styled(Tab)(({ theme }) => ({
  textTransform: "none",
  fontWeight: 500,
  color: theme.palette.primary.dark,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  "&.Mui-selected": {
    backgroundColor: theme.palette.primary.dark,
    color: theme.palette.background.default,
    border: `1px solid ${theme.palette.primary.dark}`,
  },
}));

export const StyledTab = forwardRef<HTMLButtonElement, TabProps>(
  function StyledTab(props, ref) {
    return <StyledTabRoot ref={ref as TabProps["ref"]} {...props} />;
  },
);
