import React, { FC, ReactNode, useCallback } from "react";

import { useNavigate } from "react-router";

import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import { Box, Typography, Grid, GridSize, Link } from "@mui/material";
import { SxProps, Theme } from "@mui/system";

import { IconField } from "../../icons/Icons";
import { useConfig } from "../context";
import { getProviderDisplayName } from "../utils";

import { UserAvatar } from "./UserAvatar";
import { PlaceholderText } from "./PlaceholderDescription";

export const getRemoteUrlValue = (url: string) => {
  // Convert SSH URL to HTTPS URL
  // Pattern: git@github.com:owner/repo.git → https://github.com/owner/repo.git
  const convertedUrl = url.includes("@")
    ? url.replace(/git@([^:]+):(.+)/, "https://$1/$2")
    : url;

  return (
    <Link href={convertedUrl} target="_blank" rel="noopener" underline="hover">
      {url}
    </Link>
  );
};

interface GetReferenceUrlValueProps {
  id: string;
  entityName: string;
  urlProvider?: string;
  name?: string;
  display_name?: string;
  identifier?: string;
}

export const GetReferenceUrlValue: FC<GetReferenceUrlValueProps> = ({
  id,
  entityName,
  urlProvider,
  name,
  display_name,
  identifier,
}) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const basePath = `${linkPrefix}${entityName}s`;
  const fullPath = urlProvider
    ? `${basePath}/${urlProvider}/${id}`
    : `${basePath}/${id}`;

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
      underline="hover"
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

interface GetEntityLinkProps {
  id: string;
  entityName?: string;
  name?: string;
  identifier?: string;
  sx?: SxProps<Theme>;
}

export const GetEntityLink: FC<GetEntityLinkProps> = ({
  id,
  entityName,
  name,
  identifier,
  sx,
}) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const fullPath = `${linkPrefix}${entityName}s/${id}`;
  const displayText = name || identifier;

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

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
      }}
    >
      {entityName === "user" && <UserAvatar id={id} identifier={displayText} />}
      <Link
        href={fullPath}
        onClick={handleClick}
        sx={sx}
        style={{
          textDecoration: "none",
          cursor: "pointer",
          whiteSpace: "normal",
        }}
      >
        {displayText}
      </Link>
    </Box>
  );
};

export const getTextValue = (text: any) => {
  if (text === null || text === undefined || text === "") {
    return <PlaceholderText />;
  }

  return (
    <Typography sx={{ color: "text.secondary" }}>
      {text.toString()}
    </Typography>
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
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 1,
      }}
    >
      {IconField(provider, iconSize)}
      <Typography sx={{ color: "text.secondary" }}>
        {getProviderDisplayName(provider)}
      </Typography>
    </Box>
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
      hour12: true,
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
  name: string;
  value: ReactNode;
  size?: GridSize | { xs: GridSize; md: GridSize } | undefined;
}

export const CommonField = ({ name, value, size }: ParameterFieldProps) => {
  const gridSize = size || { xs: 12, md: 6 };
  const isEmptyValue = value === null || value === undefined || value === "";
  const isStringOrNumber =
    typeof value === "string" || typeof value === "number";

  return (
    <Grid size={gridSize}>
      <Typography
        component="div"
        sx={{
          // Muted label style shared with the datagrid headers: medium weight,
          // small size, secondary color — the value is the visual anchor.
          fontWeight: 500,
          fontSize: "0.8125rem",
          color: "text.secondary",
          mb: 0.25,
        }}
      >
        {name}
      </Typography>
      {isEmptyValue ? (
        <PlaceholderText />
      ) : isStringOrNumber ? (
        <Typography>{value}</Typography>
      ) : (
        value
      )}
    </Grid>
  );
};

export const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};
