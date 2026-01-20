import { SyntheticEvent } from "react";
import { useState } from "react";

import { useLocation, useNavigate } from "react-router";

import ViewListIcon from "@mui/icons-material/ViewList";
import { Box, Tabs, Typography, Paper, Grid, Button } from "@mui/material";
import { styled } from "@mui/material/styles";

import { useConfig, StyledTab } from "../../common";
import PageContainer from "../../common/PageContainer";
import { providers } from "../constants";
import { ConnectionType, IntegrationType, Provider } from "../types";

const ProviderCard = styled(Paper)(({ theme }) => ({
  backgroundColor: "transparent",
  backgroundImage: "none",
  boxShadow: "none",
  padding: theme.spacing(2),
  textAlign: "center",
  cursor: "pointer",
  transition: "transform 0.2s ease-in-out",
  "&:hover": {
    transform: "scale(1.05)",
  },
  "& svg": {
    width: theme.spacing(7.5),
    height: theme.spacing(7.5),
  },
}));

const ProviderSection = (
  title: string,
  subtitle: string,
  providers: Provider[],
  integrationType: IntegrationType,
) => {
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  return (
    <Box sx={{ pt: 1 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mt: 2,
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h5" component="h2">
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<ViewListIcon />}
          onClick={() =>
            navigate(`${linkPrefix}integrations/${integrationType}`)
          }
          sx={{ minWidth: 200 }}
        >
          View Existing{" "}
          {integrationType.charAt(0).toUpperCase() + integrationType.slice(1)}{" "}
          Integrations
        </Button>
      </Box>
      <Grid container spacing={4} sx={{ overflow: "hidden" }}>
        {providers
          .filter((provider) => provider.connectionType !== ConnectionType.SSH)
          .map((provider) => {
            const IconComponent = provider.icon;

            return (
              <Grid
                key={provider.name}
                size={{
                  xs: 12,
                  sm: 4,
                }}
              >
                <ProviderCard
                  onClick={() =>
                    navigate(`${linkPrefix}integrations/${provider.slug}`)
                  }
                >
                  <IconComponent />
                  <Typography sx={{ fontWeight: 500 }}>
                    {provider.name}
                  </Typography>
                </ProviderCard>
              </Grid>
            );
          })}
      </Grid>
    </Box>
  );
};

const IntegrationsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState(
    location.hash ? location.hash.replace("#", "") : "git",
  );

  const handleTabChange = (event: SyntheticEvent, newValue: string) => {
    setTab(newValue);
    navigate(`#${newValue}`, { replace: true });
  };

  return (
    <PageContainer title="Integrations">
      <Box sx={{ maxWidth: 1400, width: "100%", alignSelf: "center" }}>
        <Box sx={{ pt: 1.5 }}>
          <Tabs
            value={tab}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              "& .MuiTabs-indicator": {
                display: "none",
              },
            }}
          >
            <StyledTab label="Git Integrations" value={"git"} />
            <StyledTab label="Cloud Integrations" value={"cloud"} />
          </Tabs>
        </Box>

        {tab === "git" &&
          ProviderSection(
            "Git Integrations",
            "Connect your git providers to access infrastructure templates",
            providers
              .filter((p) => IntegrationType.GIT === p.type)
              .sort((a, b) => a.name.localeCompare(b.name)),
            IntegrationType.GIT,
          )}

        {tab === "cloud" &&
          ProviderSection(
            "Cloud Integrations",
            "Connect your cloud providers for resource provisioning",
            providers
              .filter((p) => IntegrationType.CLOUD === p.type)
              .sort((a, b) => a.name.localeCompare(b.name)),
            IntegrationType.CLOUD,
          )}
      </Box>
    </PageContainer>
  );
};

IntegrationsPage.path = "/integrations";

export { IntegrationsPage };
