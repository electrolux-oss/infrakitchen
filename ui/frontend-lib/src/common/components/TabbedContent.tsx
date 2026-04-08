import { ReactNode, useEffect } from "react";

import { useLocation, useNavigate, useParams } from "react-router";

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
  const { tab: activeTabFromPath } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

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

  const activeTab = visibleTabs.find(
    (t) => t.label.toLowerCase() === activeTabFromPath?.toLowerCase(),
  );

  useEffect(() => {
    if (!activeTab && visibleTabs.length > 0) {
      const targetLabel = (
        visibleTabs.find((t) => t.label === defaultTab) || visibleTabs[0]
      ).label.toLowerCase();

      const parts = location.pathname.replace(/\/$/, "").split("/");
      if (activeTabFromPath) parts[parts.length - 1] = targetLabel;
      else parts.push(targetLabel);

      navigate(parts.join("/") + location.search, { replace: true });
    }
  }, [
    activeTab,
    activeTabFromPath,
    visibleTabs,
    defaultTab,
    location.pathname,
    location.search,
    navigate,
  ]);

  if (!activeTab) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Tabs
        value={activeTab.label}
        onChange={(_, v) => {
          const parts = location.pathname.replace(/\/$/, "").split("/");
          parts[parts.length - 1] = v.toLowerCase();
          navigate(parts.join("/") + location.search);
          onChange?.(v);
        }}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          mb: 1.5,
          "& .MuiTab-root": { textTransform: "none" },
        }}
      >
        {visibleTabs.map(({ label }) => (
          <Tab key={label} label={label} value={label} />
        ))}
      </Tabs>
      {activeTab.content}
    </Box>
  );
};
