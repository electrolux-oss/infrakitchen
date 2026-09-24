import React, { useEffect } from "react";

import { useNavigate, useParams } from "react-router";

import { Box, Tab, Tabs } from "@mui/material";

import { useConfig } from "../../common";
import PageContainer from "../../common/PageContainer";
import {
  FeatureFlagSection,
  PermissionsSection,
  SchedulerJobsSection,
} from "../components";

const ADMIN_TABS = [
  { path: "permissions", label: "Permissions" },
  { path: "feature-flags", label: "Feature Flags" },
  { path: "scheduler", label: "Scheduler" },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["path"];

const DEFAULT_TAB: AdminTab = "permissions";

const isAdminTab = (value: string | undefined): value is AdminTab =>
  ADMIN_TABS.some((tab) => tab.path === value);

export const AdminPage = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  const activeTab: AdminTab = isAdminTab(tab) ? tab : DEFAULT_TAB;

  useEffect(() => {
    if (!isAdminTab(tab)) {
      navigate(`${linkPrefix}admin/${DEFAULT_TAB}`, { replace: true });
    }
  }, [tab, navigate, linkPrefix]);

  const handleTabChange = (
    _event: React.SyntheticEvent,
    newValue: AdminTab,
  ) => {
    navigate(`${linkPrefix}admin/${newValue}`);
  };

  return (
    <PageContainer
      title="Settings"
      description="Manage permissions, feature flags, and scheduled jobs."
    >
      <Box sx={{ width: "100%" }}>
        <Box sx={{ mt: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="Settings tabs"
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              mb: 1.5,
              "& .MuiTab-root": { textTransform: "none" },
            }}
          >
            {ADMIN_TABS.map((item) => (
              <Tab key={item.path} value={item.path} label={item.label} />
            ))}
          </Tabs>
        </Box>

        <Box role="tabpanel" hidden={activeTab !== "permissions"}>
          <PermissionsSection />
        </Box>
        <Box role="tabpanel" hidden={activeTab !== "feature-flags"}>
          <FeatureFlagSection />
        </Box>
        <Box role="tabpanel" hidden={activeTab !== "scheduler"}>
          <SchedulerJobsSection />
        </Box>
      </Box>
    </PageContainer>
  );
};

AdminPage.path = "/admin/:tab?";
