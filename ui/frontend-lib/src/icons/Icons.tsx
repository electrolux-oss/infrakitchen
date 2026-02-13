import React from "react";

import { Icon } from "@iconify/react";
import CloudIcon from "@mui/icons-material/Cloud";

// Wrapper to keep a consistent signature with other MUI SvgIcon-based components.
// Accept only Iconify props (width/height/color/className/style). Ignore MUI-specific props like sx.
export type IconProps = Omit<React.ComponentProps<typeof Icon>, "icon">;

export const AwsIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:aws" {...props} />
);

export const AzureLogoIcon: React.FC<IconProps> = (props) => (
  <Icon icon="vscode-icons:file-type-azure" {...props} />
);

export const GoogleCloudIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:google-cloud" {...props} />
);

export const GithubIcon: React.FC<IconProps> = (props) => (
  <Icon icon="octicon:mark-github-24" {...props} />
);

export const GitLabIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:gitlab-icon" {...props} />
);

export const BitbucketIcon: React.FC<IconProps> = (props) => (
  <Icon icon="vscode-icons:file-type-bitbucketpipeline" {...props} />
);

export const MongoDBIcon: React.FC<IconProps> = (props) => (
  <Icon icon="devicon:mongodb" {...props} />
);

export const DatadogIcon: React.FC<IconProps> = (props) => (
  <Icon icon="vscode-icons:file-type-datadog" {...props} />
);

export const OpenTofuIcon: React.FC<IconProps> = (props) => (
  <Icon icon="vscode-icons:file-type-opentofu" {...props} />
);

const resourceIcons = new Map<string, React.ElementType>([
  ["aws", AwsIcon],
  ["azure", AzureLogoIcon],
  ["azurerm", AzureLogoIcon],
  ["azure_devops", AzureLogoIcon],
  ["azure_devops_ssh", AzureLogoIcon],
  ["microsoft", AzureLogoIcon],
  ["github", GithubIcon],
  ["github_ssh", GithubIcon],
  ["gitlab", GitLabIcon],
  ["bitbucket", BitbucketIcon],
  ["bitbucket_ssh", BitbucketIcon],
  ["gcp", GoogleCloudIcon],
  ["mongodb_atlas", MongoDBIcon],
  ["datadog", DatadogIcon],
  ["opentofu", OpenTofuIcon],
]);

export const getResourceIcon = (type: string | undefined) => {
  if (resourceIcons.has(type as string)) {
    return resourceIcons.get(type as string) as any;
  }

  return CloudIcon as any;
};

export const IconField = (type: string) => {
  const LabelIcon: any = getResourceIcon(type);
  return <LabelIcon />;
};
