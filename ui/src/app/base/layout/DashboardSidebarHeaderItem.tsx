import * as React from "react";

import DashboardSidebarContext from "../../context/DashboardSidebarContext";

import { drawerTransition } from "./mixins";

import { DRAWER_WIDTH } from "@/constants";
import { cn } from "@/index";

export interface DashboardSidebarHeaderItemProps {
  children?: React.ReactNode;
}

export default function DashboardSidebarHeaderItem({
  children,
}: DashboardSidebarHeaderItemProps) {
  const sidebarContext = React.useContext(DashboardSidebarContext);
  if (!sidebarContext) {
    throw new Error("Sidebar context was used without a provider.");
  }
  const {
    mini = false,
    fullyExpanded = true,
    hasDrawerTransitions,
  } = sidebarContext;

  return (
    <li
      className={cn(
        "z-2 overflow-hidden px-3 py-0 text-[12px] leading-[36px] font-semibold text-ellipsis whitespace-nowrap text-fg-muted",
        mini ? "h-0" : "h-9",
      )}
      style={{
        minWidth: DRAWER_WIDTH,
        transition: hasDrawerTransitions
          ? drawerTransition(fullyExpanded, "height")
          : undefined,
      }}
    >
      {children}
    </li>
  );
}
