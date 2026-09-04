import React from "react";

import { Icon } from "@iconify/react";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import { Box } from "@mui/material";

// Wrapper to keep a consistent signature with other MUI SvgIcon-based components.
// Accept only Iconify props (width/height/color/className/style). Ignore MUI-specific props like sx.
export type IconProps = Omit<React.ComponentProps<typeof Icon>, "icon">;

export const AwsIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:aws" {...props} />
);

export const AzureIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:microsoft-azure" {...props} />
);

export const MicrosoftIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:microsoft-icon" {...props} />
);

export const GoogleCloudIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:google-cloud" {...props} />
);

export const GoogleIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:google-icon" {...props} />
);

export const GitHubIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:github-icon" {...props} />
);

export const GitLabIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:gitlab-icon" {...props} />
);

export const BitbucketIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:bitbucket" {...props} />
);

export const GitIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:git-icon" {...props} />
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

export const SlackIcon: React.FC<IconProps> = (props) => (
  <Icon icon="logos:slack-icon" {...props} />
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
  ["google", GoogleIcon],
  ["gitlab", GitLabIcon],
  ["bitbucket", BitbucketIcon],
  ["bitbucket_ssh", BitbucketIcon],
  ["git_public", GitIcon],
  ["gcp", GoogleCloudIcon],
  ["mongodb_atlas", MongoDBIcon],
  ["datadog", DatadogIcon],
  ["opentofu", OpenTofuIcon],
  ["slack", SlackIcon],
]);

export const getResourceIcon = (type: string | undefined) => {
  if (resourceIcons.has(type as string)) {
    return resourceIcons.get(type as string) as any;
  }

  return CloudQueueIcon as any;
};

export const IconField = (type: string | undefined, size?: number) => {
  const LabelIcon: any = getResourceIcon(type);
  const sizeProps = size ? { width: size, height: size } : {};
  return <LabelIcon {...sizeProps} />;
};

/**
 * Provider icon rendered at a fixed size inside a non-shrinking wrapper.
 * Use inside flex rows/table cells: flexbox cannot rescale or squeeze the SVG,
 * so the icon renders identically in every row regardless of content length.
 */
export const ProviderIcon: React.FC<{
  provider?: string;
  size?: number;
}> = ({ provider, size = 16 }) => (
  <Box
    component="span"
    aria-hidden
    sx={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      lineHeight: 0,
      "& svg": {
        width: size,
        height: size,
        flexShrink: 0,
      },
    }}
  >
    {IconField(provider, size)}
  </Box>
);
