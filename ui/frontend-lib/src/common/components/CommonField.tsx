import React, { FC, ReactNode, useCallback } from "react";

import { useNavigate } from "react-router";

import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import { Box, Typography, Chip, Grid, GridSize, Link } from "@mui/material";

import { IconField } from "../../icons/Icons";
import { useConfig } from "../context";
import { getProviderDisplayName } from "../utils";

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
  _entity_name: string;
  urlProvider?: string;
  name?: string;
  display_name?: string;
  identifier?: string;
}

export const GetReferenceUrlValue: FC<GetReferenceUrlValueProps> = ({
  id,
  _entity_name,
  urlProvider,
  name,
  display_name,
  identifier,
}) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const basePath = `${linkPrefix}${_entity_name}s`;
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
      style={{
        textDecoration: "none",
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
  _entity_name: string;
  name?: string;
  identifier?: string;
}

export const GetEntityLink: FC<GetEntityLinkProps> = ({
  id,
  _entity_name,
  name,
  identifier,
}) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const fullPath = `${linkPrefix}${_entity_name}s/${id}`;

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
    <Link
      href={fullPath}
      onClick={handleClick}
      style={{
        textDecoration: "none",
        cursor: "pointer",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
      }}
    >
      {name || identifier}
    </Link>
  );
};

export const getTextValue = (text: any) => {
  const displayText =
    text === null || text === undefined || text === ""
      ? "N/A"
      : text.toString();

  return (
    <Typography variant="body2" sx={{ color: "text.secondary" }}>
      {displayText}
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
    <Box display="flex" alignItems="center" justifyContent="flex-start" gap={1}>
      {IconField(provider, iconSize)}
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
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

export const getLabels = (labels: string[]) => {
  if (!labels || labels.length === 0) {
    return getTextValue("No labels");
  }

  return (
    <Box display="flex" gap={1} flexWrap="wrap" marginTop={1} marginBottom={2}>
      {labels.map((label: string) => (
        <Chip key={label} label={label} size="small" variant="outlined" />
      ))}
    </Box>
  );
};

export interface ParameterFieldProps {
  name: string;
  value: ReactNode;
  size?: GridSize | { xs: GridSize; md: GridSize } | undefined;
}

export const CommonField = ({ name, value, size }: ParameterFieldProps) => {
  const gridSize = size || { xs: 12, md: 6 };
  const isStringOrNumber =
    typeof value === "string" || typeof value === "number";

  return (
    <Grid size={gridSize}>
      <Typography variant="body1" sx={{ fontWeight: "bold" }}>
        {name}
      </Typography>
      {isStringOrNumber ? (
        <Typography variant="body2">{value}</Typography>
      ) : (
        value
      )}
    </Grid>
  );
};

export const capitalizeFirstLetter = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};
