import { ReactNode, useMemo } from "react";

import { ExpandLess, ExpandMore, InfoOutlined } from "@mui/icons-material";
import { Box, CardContent, CardHeader, Tooltip } from "@mui/material";
import Card from "@mui/material/Card";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";

import { useLocalStorage } from "../context/UIStateContext";

export interface PropertyCollapseCardProps {
  title: string | ReactNode;
  subtitle?: string;
  children?: ReactNode;
  expanded?: boolean;
  id: string;
}

export const PropertyCollapseCard = (props: PropertyCollapseCardProps) => {
  const { title, children, subtitle, expanded = true, id } = props;
  const { value, set } = useLocalStorage<{
    expanded?: Record<string, boolean>;
  }>();
  const expandedMap = value.expanded ?? {};
  const cardId = useMemo(() => id || String(title), [id, title]);
  const isExpanded = id ? expandedMap[cardId] === true : expanded;

  const toggleExpanded = (key: string) => {
    set((prev) => ({
      ...prev,
      expanded: { ...prev.expanded, [key]: !prev.expanded?.[key] },
    }));
  };

  return (
    <Card sx={{ width: "100%" }}>
      <CardHeader
        title={
          <Box
            display="flex"
            alignItems="center"
            onClick={() => toggleExpanded(cardId)}
          >
            {title}
            {subtitle && (
              <Tooltip title={subtitle} arrow>
                <Box
                  component="span"
                  sx={{
                    ml: 1,
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    color: "info.main",
                    fontSize: 16,
                  }}
                  onClick={(e) => e.stopPropagation()}
                  tabIndex={0}
                >
                  <InfoOutlined fontSize="inherit" />
                </Box>
              </Tooltip>
            )}
            <IconButton
              disableRipple
              disableFocusRipple
              sx={{
                marginLeft: "auto",
                "&:hover": {
                  backgroundColor: "transparent",
                },
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(cardId);
              }}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              size="small"
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        }
      />
      <Collapse in={isExpanded}>
        <CardContent>{children}</CardContent>
      </Collapse>
    </Card>
  );
};
