import * as React from "react";

import DashboardSidebarContext from "../../context/DashboardSidebarContext";

import { SIDEBAR_ITEM_CLASS } from "./mixins";

import {
  cn,
  ListItemIcon,
  ListItemText,
  HeroBars3Icon,
  HeroBars3BottomLeftIcon,
  Tooltip,
} from "@/index";

export interface DashboardSidebarToggleItemProps {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

export default function DashboardSidebarToggleItem({
  expanded,
  setExpanded,
}: DashboardSidebarToggleItemProps) {
  const sidebarContext = React.useContext(DashboardSidebarContext);
  if (!sidebarContext) {
    throw new Error("Sidebar context was used without a provider.");
  }
  const { mini = false } = sidebarContext;

  const handleClick = React.useCallback(() => {
    setExpanded(!expanded);
  }, [expanded, setExpanded]);

  const icon = expanded ? <HeroBars3BottomLeftIcon /> : <HeroBars3Icon />;

  return (
    <Tooltip
      title={mini ? (expanded ? "Collapse" : "Expand") : ""}
      placement="right"
      enterDelay={500}
    >
      <div className="block overflow-x-hidden px-2">
        <button
          type="button"
          className={cn(SIDEBAR_ITEM_CLASS, "font-sans", mini && "h-8.5")}
          onClick={handleClick}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {mini ? (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <ListItemIcon className="mr-0 flex items-center justify-center">
                {icon}
              </ListItemIcon>
            </div>
          ) : (
            <React.Fragment>
              <ListItemIcon className="mr-0 flex items-center">
                {icon}
              </ListItemIcon>
              <ListItemText
                className="z-1 whitespace-nowrap"
                primary={expanded ? "Collapse" : "Expand"}
              />
            </React.Fragment>
          )}
        </button>
      </div>
    </Tooltip>
  );
}
