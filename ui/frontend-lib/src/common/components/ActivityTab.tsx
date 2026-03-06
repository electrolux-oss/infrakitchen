import { useState, SyntheticEvent } from "react";

import { useLocation, useNavigate } from "react-router";

import { TabContext, TabPanel } from "@mui/lab";
import { Box, Tabs } from "@mui/material";

import { StyledTab } from "..";
import { useEntityProvider } from "../context/EntityContext";

import { Audit } from "./activity/Audit";
import { Revision } from "./activity/Revision";

interface ActivityTabProps {
  tabs: string[];
}

export const ActivityTab = ({ tabs }: ActivityTabProps) => {
  const { entity } = useEntityProvider();

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
  );
};
