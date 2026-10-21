import React, { FC, ReactNode, useCallback } from "react";

import { useNavigate } from "react-router";

import { getProviderIcon, IconField } from "../../../icons/Icons";
import { Link } from "../../../ui";
import { Label } from "../../../ui/Label";
import { cn } from "../../../utils/cn";
import { useConfig } from "../../context";
import { getProviderDisplayName } from "../../utils";
import { entityIcons } from "../entities/entityIcons";

import { PlaceholderText } from "./PlaceholderDescription";

export const getRemoteUrlValue = (url: string) => {
  // Convert SSH URL to HTTPS URL
  // Pattern: git@github.com:owner/repo.git → https://github.com/owner/repo.git
  const convertedUrl = url.includes("@")
    ? url.replace(/git@([^:]+):(.+)/, "https://$1/$2")
    : url;

  return (
    <Link href={convertedUrl} target="_blank" rel="noopener">
      {url}
    </Link>
  );
};

interface EntityReferenceProps {
  id: string;
  entityName: string;
  name?: string;
  display_name?: string;
  identifier?: string;
}

/** Reference rendered as a label pill with the entity icon, linking to the entity. */
export const EntityReference: FC<
  EntityReferenceProps & {
    icon?: React.ComponentProps<typeof Label>["icon"];
    tone?: React.ComponentProps<typeof Label>["tone"];
    /** Shows the provider's brand icon instead of the entity icon. */
    provider?: string;
    /** Provider route segment, as used by integration detail pages. */
    urlProvider?: string;
  }
> = ({
  id,
  entityName,
  name,
  display_name,
  identifier,
  icon,
  tone,
  provider,
  urlProvider,
}) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const basePath = `${linkPrefix}${entityName}s`;
  const fullPath = urlProvider
    ? `${basePath}/${urlProvider}/${id}`
    : `${basePath}/${id}`;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      // Allow default behavior for Cmd/Ctrl+Click (opens in new tab)
      if (e.metaKey || e.ctrlKey) {
        return;
      }

      e.preventDefault();
      navigate(fullPath);
    },
    [navigate, fullPath],
  );

  const resolvedIcon =
    icon ??
    (provider
      ? React.createElement(getProviderIcon(provider), {
          className: "size-[1em]",
        })
      : entityIcons[entityName]);

  return (
    <Label
      component="a"
      href={fullPath}
      onClick={handleClick}
      icon={resolvedIcon}
      tone={tone}
      label={display_name || name || identifier}
    />
  );
};

export const getProviderValue = (provider: string, iconSize: number = 24) => {
  return (
    // Keep brand and fallback SVGs at the same requested size.
    <div
      className="flex items-center justify-start gap-2 [&_svg]:size-[var(--icon-size)]"
      style={{ "--icon-size": `${iconSize}px` } as React.CSSProperties}
    >
      {IconField(provider, iconSize)}
      <p className="m-0 text-body2">{getProviderDisplayName(provider)}</p>
    </div>
  );
};

export const getDateValue = (date: Date | string) => {
  try {
    const dateObj = new Date(date);

    return dateObj.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch (_) {
    return "Invalid Date";
  }
};

export const getTimeOnlyValue = (date: Date | string) => {
  try {
    const dateObj = new Date(date);

    return dateObj.toLocaleString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch (_) {
    return "Invalid Date";
  }
};

export interface ParameterFieldProps {
  name: ReactNode;
  value: ReactNode;
  /** Width in the surrounding field grid; `half` (default) shares a row. */
  span?: FieldSpan;
}

/** Cell width of a field in a BaseCard or sidebar section grid. */
export type FieldSpan = "full" | "half";

export const CommonField = ({
  name,
  value,
  span = "half",
}: ParameterFieldProps) => {
  const isEmptyValue = value === null || value === undefined || value === "";
  const isStringOrNumber =
    typeof value === "string" || typeof value === "number";

  return (
    <div
      className={cn("group/field min-w-0", span === "full" && "col-span-full")}
    >
      <div
        // Muted label style shared with the datagrid headers: medium weight,
        // small size, secondary color — the value is the visual anchor.
        className="m-0 mb-0.5 text-[0.8125rem] font-medium text-fg-muted"
      >
        {name}
      </div>
      {isEmptyValue ? (
        <PlaceholderText />
      ) : isStringOrNumber ? (
        // Long unbroken values (paths, ids) wrap instead of overflowing.
        <p className="m-0 text-body2 wrap-anywhere">{value}</p>
      ) : (
        value
      )}
    </div>
  );
};

export const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};
