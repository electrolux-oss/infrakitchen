import React, { FC, ReactNode, useCallback } from "react";

import { useNavigate } from "react-router";

import { IconField } from "../../../icons/Icons";
import { ToggleOffIcon, ToggleOnIcon } from "../../../icons/material";
import { Link } from "../../../ui";
import { cn } from "../../../utils/cn";
import { useConfig } from "../../context";
import { getProviderDisplayName } from "../../utils";

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

interface GetReferenceUrlValueProps {
  id: string;
  entityName: string;
  name?: string;
  display_name?: string;
  identifier?: string;
}

export const GetReferenceUrlValue: FC<GetReferenceUrlValueProps> = ({
  id,
  entityName,
  name,
  display_name,
  identifier,
}) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const fullPath = `${linkPrefix}${entityName}s/${id}`;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Allow default behavior for Cmd/Ctrl+Click (opens in new tab)
      if (e.metaKey || e.ctrlKey) {
        return;
      }

      e.preventDefault();
      navigate(fullPath);
    },
    [navigate, fullPath],
  );

  const displayText = display_name || name || identifier;
  return (
    <Link
      href={fullPath}
      onClick={handleClick}
      style={{
        cursor: "pointer",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
      }}
    >
      {displayText}
    </Link>
  );
};

export const getBooleanLabel = (value: boolean) => {
  return value ? (
    <ToggleOnIcon color="success" titleAccess="Enabled" />
  ) : (
    <ToggleOffIcon color="disabled" titleAccess="Disabled" />
  );
};

export const getProviderValue = (provider: string, iconSize: number = 24) => {
  return (
    // Force both Iconify and Material icon SVGs to the requested size —
    // Material icons are sized in CSS (1em) and ignore width/height.
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
    <div className={cn("min-w-0", span === "full" && "col-span-full")}>
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
