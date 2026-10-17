import { useNavigate } from "react-router";

import { Icon } from "@iconify/react";
import octiconCloud24Data from "@iconify-icons/octicon/cloud-24";
import octiconGitBranch24Data from "@iconify-icons/octicon/git-branch-24";

import { useConfig } from "../../common";
import {
  InventoryIcon,
  LibraryBooksIcon,
  RocketLaunchOutlinedIcon,
} from "../../icons/material";
import { Divider, Button } from "../../ui";

const steps = [
  {
    title: "Integrate Git Provider(s)",
    description:
      "Connect your git providers (GitHub, GitLab, Bitbucket, Azure Repos) to access infrastructure templates",
    button: "Connect Git",
    navigateTo: "integrations#git",
    icon: <Icon icon={octiconGitBranch24Data} ssr width="20" height="20" />,
  },
  {
    title: "Integrate Cloud Provider(s)",
    description:
      "Link your cloud providers (AWS, Azure, GCP) for resource provisioning",
    button: "Connect Cloud",
    navigateTo: "integrations#cloud",
    icon: <Icon icon={octiconCloud24Data} ssr width="20" height="20" />,
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
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <RocketLaunchOutlinedIcon className="text-[20px] text-primary" />
        <h6 className="m-0 text-subtitle1 font-semibold text-grey-500">
          Getting Started
        </h6>
      </div>
      <Divider className="mb-3" />
      <div className="overflow-hidden rounded-surface border border-divider bg-paper">
        {steps.map((step, idx) => (
          <div
            // On phones the button drops below the step text.
            className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap [&:not(:first-of-type)]:border-t [&:not(:first-of-type)]:border-divider"
            key={step.title}
          >
            <span className="mt-[2.4px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.75rem] leading-[1] text-primary-contrast">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-[1_1_0]">
              <p className="m-0 mb-1 text-[16px] font-semibold">{step.title}</p>
              <p className="m-0 text-body2 text-fg-muted">{step.description}</p>
            </div>
            <Button
              className="ml-0 w-full shrink-0 sm:ml-auto sm:w-50"
              variant="outlined"
              size="small"
              startIcon={step.icon}
              onClick={() => navivate(`${linkPrefix}${step.navigateTo}`)}
            >
              {step.button}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
