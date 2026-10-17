import React from "react";

import { Icon } from "@iconify/react";
import deviconMongodbData from "@iconify-icons/devicon/mongodb";
import deviconPostgresqlData from "@iconify-icons/devicon/postgresql";
import logosAwsData from "@iconify-icons/logos/aws";
import logosBitbucketData from "@iconify-icons/logos/bitbucket";
import logosGitIconData from "@iconify-icons/logos/git-icon";
import logosGitlabIconData from "@iconify-icons/logos/gitlab-icon";
import logosGoogleCloudData from "@iconify-icons/logos/google-cloud";
import logosGoogleIconData from "@iconify-icons/logos/google-icon";
import logosMicrosoftAzureData from "@iconify-icons/logos/microsoft-azure";
import logosMicrosoftIconData from "@iconify-icons/logos/microsoft-icon";
import logosSlackIconData from "@iconify-icons/logos/slack-icon";
import logosTerraformIconData from "@iconify-icons/logos/terraform-icon";
import mdiGithubData from "@iconify-icons/mdi/github";
import vscodeIconsFileTypeDatadogData from "@iconify-icons/vscode-icons/file-type-datadog";
import vscodeIconsFileTypeOpentofuData from "@iconify-icons/vscode-icons/file-type-opentofu";

import { CloudQueueIcon } from "./material";

// Brand and provider icons take Iconify's props (width/height/color/className/style).
export type IconProps = Omit<React.ComponentProps<typeof Icon>, "icon">;

export const AwsIcon: React.FC<IconProps> = (props) => (
  <Icon icon={logosAwsData} ssr {...props} />
);

export const AzureIcon: React.FC<IconProps> = (props) => (
  <Icon icon={logosMicrosoftAzureData} ssr {...props} />
);

export const MicrosoftIcon: React.FC<IconProps> = (props) => (
  <Icon icon={logosMicrosoftIconData} ssr {...props} />
);

export const GoogleCloudIcon: React.FC<IconProps> = (props) => (
  <Icon icon={logosGoogleCloudData} ssr {...props} />
);

export const GoogleIcon: React.FC<IconProps> = (props) => (
  <Icon icon={logosGoogleIconData} ssr {...props} />
);

export const GitHubIcon: React.FC<IconProps> = (props) => (
  <Icon icon={mdiGithubData} ssr color="currentColor" {...props} />
);

export const GitLabIcon: React.FC<IconProps> = (props) => (
  <Icon icon={logosGitlabIconData} ssr {...props} />
);

export const BitbucketIcon: React.FC<IconProps> = (props) => (
  <Icon icon={logosBitbucketData} ssr {...props} />
);

export const GitIcon: React.FC<IconProps> = (props) => (
  <Icon icon={logosGitIconData} ssr {...props} />
);

export const MongoDBIcon: React.FC<IconProps> = (props) => (
  <Icon icon={deviconMongodbData} ssr {...props} />
);

export const PostgreSQLIcon: React.FC<IconProps> = (props) => (
  <Icon icon={deviconPostgresqlData} ssr {...props} />
);

export const DatadogIcon: React.FC<IconProps> = (props) => (
  <Icon icon={vscodeIconsFileTypeDatadogData} ssr {...props} />
);

export const OpenTofuIcon: React.FC<IconProps> = (props) => (
  <Icon icon={vscodeIconsFileTypeOpentofuData} ssr {...props} />
);

export const TerraformIcon: React.FC<IconProps> = (props) => (
  <Icon icon={logosTerraformIconData} ssr {...props} />
);

export const SlackIcon: React.FC<IconProps> = (props) => (
  <Icon icon={logosSlackIconData} ssr {...props} />
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
  ["postgresql", PostgreSQLIcon],
  ["opentofu", OpenTofuIcon],
  ["terraform", TerraformIcon],
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
}> = ({ provider, size = 18 }) => (
  <span
    className="inline-flex shrink-0 items-center justify-center leading-[0] [&_svg]:size-[var(--icon-size)] [&_svg]:shrink-0"
    style={{ "--icon-size": `${size}px` } as React.CSSProperties}
    aria-hidden
  >
    {IconField(provider, size)}
  </span>
);
