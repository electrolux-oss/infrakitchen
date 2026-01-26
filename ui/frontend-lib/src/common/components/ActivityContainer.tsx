import { useState, SyntheticEvent } from "react";

import { useLocation, useNavigate } from "react-router";

import { TabContext, TabPanel } from "@mui/lab";
import { Box, Tabs } from "@mui/material";

import { LogList, StyledTab } from "..";
import { useConfig } from "../context/ConfigContext";
import { useEntityProvider } from "../context/EntityContext";
import PageContainer from "../PageContainer";

import { Audit } from "./activity/Audit";
import { Revision } from "./activity/Revision";

interface ActivityPageProps {
  tabs: string[];
}

export const ActivityContainer = (props: ActivityPageProps) => {
  const { tabs } = props;

  const { entity, entity_name } = useEntityProvider();
  const { linkPrefix } = useConfig();

  const location = useLocation();

  const navigate = useNavigate();

  const [path, setPath] = useState(
    location.hash
      ? location.hash.replace("#", "")
      : tabs.includes("logs")
        ? "logs"
        : tabs[0],
  );

  const handleChange = (event: SyntheticEvent, newValue: string) => {
    setPath(newValue);
    navigate(`#${newValue}`, { replace: true });
  };

  if (!entity) {
    return null;
  }

  return (
    <PageContainer
      title={entity.name || entity.identifier || entity_name}
      onBack={() => navigate(`${linkPrefix}${entity_name}s/${entity.id}`)}
    >
      <Box sx={{ width: "100%", maxWidth: 1400 }}>
        <TabContext value={path}>
          <Box sx={{ py: 1.5 }}>
            <Tabs
              value={path}
              onChange={handleChange}
              variant="fullWidth"
              sx={{
                "& .MuiTabs-indicator": {
                  display: "none",
                },
              }}
            >
              {tabs.map((tab) => (
                <StyledTab
                  disableRipple
                  value={tab}
                  label={tab.charAt(0).toUpperCase() + tab.slice(1)}
                  key={tab}
                  id={`tab-${tab}`}
                  aria-controls={`tabpanel-${tab}`}
                />
              ))}
            </Tabs>
          </Box>
          {tabs.includes("logs") && (
            <TabPanel
              value="logs"
              id="tabpanel-logs"
              aria-labelledby="tab-logs"
              sx={{ p: 0 }}
            >
              <LogList entity_id={entity.id || ""} />
            </TabPanel>
          )}
          {tabs.includes("audit") && (
            <TabPanel
              value="audit"
              sx={{ p: 0 }}
              id="tabpanel-audit"
              aria-labelledby="tab-audit"
            >
              <Audit entityId={entity.id || ""} />
            </TabPanel>
          )}
          {tabs.includes("revisions") && (
            <TabPanel
              value="revisions"
              sx={{ p: 0 }}
              id="tabpanel-revisions"
              aria-labelledby="tab-revisions"
            >
              <Revision resourceId={entity.id || ""} resourceRevision={0} />
            </TabPanel>
          )}
        </TabContext>
      </Box>
    </PageContainer>
  );
};
