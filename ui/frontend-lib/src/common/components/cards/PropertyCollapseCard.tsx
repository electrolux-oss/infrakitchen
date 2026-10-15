import { ReactNode, useMemo } from "react";

import {
  ExpandLessIcon,
  ExpandMoreIcon,
  InfoOutlinedIcon,
} from "../../../icons/material";
import {
  IconButton,
  Tooltip,
  CardContent,
  CardHeader,
  Card,
  Collapse,
} from "../../../ui";
import { useLocalStorage } from "../../context/UIStateContext";

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
    <Card className="w-full">
      <CardHeader
        title={
          <div
            className="flex items-center"
            onClick={() => toggleExpanded(cardId)}
          >
            {title}
            {subtitle && (
              <Tooltip title={subtitle} arrow>
                <span
                  className="ml-2 flex cursor-pointer items-center text-[16px] text-info"
                  onClick={(e) => e.stopPropagation()}
                  tabIndex={0}
                >
                  <InfoOutlinedIcon fontSize="inherit" />
                </span>
              </Tooltip>
            )}
            <IconButton
              className="ml-auto hover:bg-transparent"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(cardId);
              }}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse" : "Expand"}
              size="small"
            >
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </div>
        }
      />
      <Collapse in={isExpanded}>
        <CardContent>{children}</CardContent>
      </Collapse>
    </Card>
  );
};
