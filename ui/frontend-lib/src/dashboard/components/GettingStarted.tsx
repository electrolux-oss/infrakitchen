import { useNavigate } from "react-router";

import { Icon } from "@iconify/react";
import InventoryIcon from "@mui/icons-material/Inventory";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined";
import { Box, Button, Divider, Typography } from "@mui/material";

import { useConfig } from "../../common";

const steps = [
  {
    title: "Integrate Git Provider(s)",
    description:
      "Connect your git providers (GitHub, GitLab, Bitbucket, Azure Repos) to access infrastructure templates",
    button: "Connect Git",
    navigateTo: "integrations#git",
    icon: <Icon icon="octicon:git-branch-24" width="20" height="20" />,
  },
  {
    title: "Integrate Cloud Provider(s)",
    description:
      "Link your cloud providers (AWS, Azure, GCP) for resource provisioning",
    button: "Connect Cloud",
    navigateTo: "integrations#cloud",
    icon: <Icon icon="octicon:cloud-24" width="20" height="20" />,
  },
  {
    title: "Import Templates",
    description: "Import infrastructure templates from your git repositories",
    button: "Import Templates",
    navigateTo: "templates",
    icon: <LibraryBooksIcon fontSize="small" />,
  },
  {
    title: "Provision Resources",
    description: "Deploy your infrastructure based on your templates",
    button: "Provision Resources",
    navigateTo: "resources",
    icon: <InventoryIcon fontSize="small" />,
  },
];

export const GettingStartedContent = () => {
  const { linkPrefix } = useConfig();
  const navivate = useNavigate();

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <RocketLaunchOutlinedIcon
          sx={{ color: "primary.main", fontSize: 20 }}
        />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Getting Started
        </Typography>
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "var(--template-surface-radius)",
          backgroundColor: "background.paper",
          overflow: "hidden",
        }}
      >
        {steps.map((step, idx) => (
          <Box
            key={step.title}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              px: 2,
              py: 2,
              "&:not(:first-of-type)": {
                borderTop: 1,
                borderColor: "divider",
              },
            }}
          >
            <Box
              component="span"
              sx={{
                width: 20,
                height: 20,
                flexShrink: 0,
                mt: 0.3,
                borderRadius: "50%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "primary.main",
                color: "primary.contrastText",
                fontSize: "0.75rem",
                lineHeight: 1,
              }}
            >
              {idx + 1}
            </Box>
            <Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  fontSize: 16,
                  mb: 0.5,
                }}
              >
                {step.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                }}
              >
                {step.description}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={step.icon}
              sx={{ width: "200px", flexShrink: 0, ml: "auto" }}
              onClick={() => navivate(`${linkPrefix}${step.navigateTo}`)}
            >
              {step.button}
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
