import { useNavigate } from "react-router";

import { Icon } from "@iconify/react";
import { Box, Button, Stack, Typography } from "@mui/material";

import { useConfig } from "../common";

const steps = [
  {
    title: "Integrate Git Provider(s)",
    description:
      "Connect your git providers (GitHub, Bitbucket, Azure Repos) to access infrastructure templates",
    button: "Integrate Git",
    navigateTo: "integrations#git",
    icon: <Icon icon="noto:fork-and-knife" width="24" height="24" />,
  },
  {
    title: "Integrate Cloud Provider(s)",
    description:
      "Link your cloud providers (AWS, Azure, GCP) for resource provisioning",
    button: "Integrate Cloud",
    navigateTo: "integrations#cloud",
    icon: <Icon icon="noto:fork-and-knife" width="24" height="24" />,
  },
  {
    title: "Import Templates",
    description: "Import infrastructure templates from your git repositories",
    button: "Import Templates",
    navigateTo: "templates",
    icon: <Icon icon="noto:canned-food" width="24" height="24" />,
  },
  {
    title: "Provision Resources",
    description: "Deploy your infrastructure based on the composed blueprints",
    button: "Provision Resources",
    navigateTo: "resources",
    icon: <Icon icon="emojione:delivery-truck" width="24" height="24" />,
  },
];

const GettingStartedPage = () => {
  const { linkPrefix } = useConfig();
  const navivate = useNavigate();

  return (
    <Box sx={{ p: 6, maxWidth: 1000, mx: "auto" }}>
      <Typography variant="h1" fontWeight={600} color="primary" gutterBottom>
        Welcome to InfraKitchen
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={6}>
        Streamline your infrastructure management with our powerful platform for
        composing, deploying, and managing infrastructure as code.
      </Typography>

      <Stack direction="row" alignItems="center" gap={2} mb={3}>
        <Icon icon="emojione:shopping-cart" width="24" height="24" />
        <Typography variant="h2" color="primary">
          Getting Started
        </Typography>
      </Stack>

      {steps.map((step, idx) => (
        <Box
          key={step.title}
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          borderTop={1}
          borderColor="divider"
          py={2.5}
        >
          <Box>
            <Typography variant="body1" mb={0.5}>
              {idx + 1}. {step.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {step.description}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={step.icon}
            sx={{ minWidth: "200px" }}
            onClick={() => navivate(`${linkPrefix}${step.navigateTo}`)}
          >
            {step.button}
          </Button>
        </Box>
      ))}
    </Box>
  );
};

GettingStartedPage.path = "/getting-started";

export { GettingStartedPage };
