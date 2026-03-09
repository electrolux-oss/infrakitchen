import { useState, SyntheticEvent, ReactNode } from "react";

import { Box, Tab, Tabs } from "@mui/material";

import { usePermissionProvider } from "../context";

export interface TabDefinition {
  label: string;
  content: ReactNode;
  requiredPermission?: string;
  permissionAction?: "read" | "write" | "admin";
}

interface TabbedContentProps {
  tabs: TabDefinition[];
  defaultTab?: string;
  onChange?: (label: string) => void;
}

export const TabbedContent = ({
  tabs,
  defaultTab,
  onChange,
}: TabbedContentProps) => {
  const { permissions } = usePermissionProvider();

  const visibleTabs = tabs.filter(
    ({ requiredPermission, permissionAction }) => {
      if (!requiredPermission || !permissionAction) return true;
      if (permissions["*"] === "admin") return true;
      const p = permissions[requiredPermission];
      if (!p) return false;
      if (permissionAction === "read") return true;
      if (permissionAction === "write") return p === "write" || p === "admin";
      if (permissionAction === "admin") return p === "admin";
      return false;
    },
  );

  const [tab, setTab] = useState(defaultTab ?? visibleTabs[0]?.label);

  const handleChange = (_: SyntheticEvent, val: string) => {
    setTab(val);
    onChange?.(val);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Tabs
        value={tab}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
      >
        {visibleTabs.map(({ label }) => (
          <Tab key={label} label={label} value={label} />
        ))}
      </Tabs>

      {visibleTabs.find((t) => t.label === tab)?.content}
    </Box>
  );
};
