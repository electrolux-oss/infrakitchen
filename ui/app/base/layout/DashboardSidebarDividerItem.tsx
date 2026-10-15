import * as React from "react";

import { Divider } from "@electrolux-oss/infrakitchen";

import DashboardSidebarContext from "../../context/DashboardSidebarContext";

import { drawerTransition } from "./mixins";

export default function DashboardSidebarDividerItem() {
  const sidebarContext = React.useContext(DashboardSidebarContext);
  if (!sidebarContext) {
    throw new Error("Sidebar context was used without a provider.");
  }
  const { fullyExpanded = true, hasDrawerTransitions } = sidebarContext;

  return (
    <li>
      <Divider
        className="-mx-1 my-2"
        style={
          hasDrawerTransitions
            ? { transition: drawerTransition(fullyExpanded, "margin") }
            : undefined
        }
      />
    </li>
  );
}
