import React from "react";

import { Icon } from "@iconify/react";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";

// Wrapper to keep a consistent signature with other MUI SvgIcon-based components.
// Accept only Iconify props (width/height/color/className/style). Ignore MUI-specific props like sx.
export type IconProps = Omit<React.ComponentProps<typeof Icon>, "icon">;

export const AwsIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:aws" {...props} />
);

export const AzureIcon: React.FC<IconProps> = (props) => (
  <Icon icon="vscode-icons:file-type-azure" {...props} />
);

export const MicrosoftIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:microsoft-icon" {...props} />
);

export const GoogleCloudIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:google-cloud" {...props} />
);

export const GitHubIcon: React.FC<IconProps> = (props) => (
  <Icon icon="octicon:mark-github-24" {...props} />
);

export const GitLabIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:gitlab-icon" {...props} />
);

export const BitbucketIcon: React.FC<IconProps> = (props) => (
  <Icon icon="vscode-icons:file-type-bitbucketpipeline" {...props} />
);

export const GitIcon: React.FC<IconProps> = (props) => (
  <Icon icon="skill-icons:git" {...props} />
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
  ["azure", AzureIcon],
  ["azurerm", AzureIcon],
  ["azure_devops", AzureIcon],
  ["azure_devops_ssh", AzureIcon],
  ["microsoft", MicrosoftIcon],
  ["github", GitHubIcon],
  ["github_ssh", GitHubIcon],
  ["gitlab", GitLabIcon],
  ["bitbucket", BitbucketIcon],
  ["bitbucket_ssh", BitbucketIcon],
  ["git_public", GitIcon],
  ["gcp", GoogleCloudIcon],
  ["mongodb_atlas", MongoDBIcon],
  ["datadog", DatadogIcon],
  ["opentofu", OpenTofuIcon],
]);

export const getResourceIcon = (type: string | undefined) => {
  if (resourceIcons.has(type as string)) {
    return resourceIcons.get(type as string) as any;
  }

  return CloudQueueIcon as any;
};

export const IconField = (type: string, size?: number) => {
  const LabelIcon: any = getResourceIcon(type);
  const sizeProps = size ? { width: size, height: size } : {};
  return <LabelIcon {...sizeProps} />;
};
