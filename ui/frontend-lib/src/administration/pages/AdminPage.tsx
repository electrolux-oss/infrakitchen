import React, { useState } from "react";

import { Box, Tab, Tabs } from "@mui/material";

import PageContainer from "../../common/PageContainer";
import {
  FeatureFlagSection,
  PermissionsSection,
  SchedulerJobsSection,
} from "../components";

export const AdminPage = () => {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <PageContainer title="Administration">
      <Box sx={{ width: "100%", maxWidth: 1200 }}>
        <Box sx={{ mt: 2 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="Administration tabs"
          >
            <Tab label="Permissions" />
            <Tab label="Feature Flags" />
            <Tab label="Scheduler" />
          </Tabs>
        </Box>

        <Box role="tabpanel" hidden={activeTab !== 0}>
          <PermissionsSection />
        </Box>
        <Box role="tabpanel" hidden={activeTab !== 1}>
          <FeatureFlagSection />
        </Box>
        <Box role="tabpanel" hidden={activeTab !== 2}>
          <SchedulerJobsSection />
        </Box>
      </Box>
    </PageContainer>
  );
};

AdminPage.path = "/admin";
