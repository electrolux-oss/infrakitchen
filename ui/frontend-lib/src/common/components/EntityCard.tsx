import { ReactNode } from "react";

import { useNavigate } from "react-router";

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Chip,
  Divider,
  CardActions,
  Button,
} from "@mui/material";

import { PermissionWrapper } from "../wrappers";

export interface EntityCardProps {
  name: string;
  entity_name: string;
  description: string;
  detailsUrl: string;
  createUrl?: string;
  onCreateClick?: () => void;
  labels: string[];
  createButtonName?: string | undefined;
  entityFields: ReactNode;
  status?: string;
  icon?: ReactNode;
  chip?: string;
  chipColor?:
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "warning"
    | "info"
    | "success";
  lastUpdated?: string;
}

export const EntityCard = ({
  name,
  description,
  detailsUrl,
  createUrl,
  onCreateClick,
  labels,
  createButtonName,
  entityFields,
  entity_name,
  icon,
  chip,
  chipColor = "info",
  lastUpdated,
}: EntityCardProps) => {
  const navigate = useNavigate();

  const handleCreateClick = () => {
    if (onCreateClick) {
      onCreateClick();
    } else if (createUrl) {
      navigate(createUrl);
    }
  };

  // Show "Updated" chip if lastUpdated is within the last 7 days
  const daysSinceUpdate = lastUpdated
    ? Math.floor(
        (new Date().getTime() - new Date(lastUpdated).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : Infinity;
  const isRecentlyUpdated = daysSinceUpdate <= 7;

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          borderColor: "text.disabled",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
        },
      }}
    >
      <CardHeader
        avatar={icon}
        title={
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            {name}
            {isRecentlyUpdated && (
              <Chip
                label="Updated"
                size="small"
                color="success"
                variant="filled"
              />
            )}
          </Box>
        }
        subheader={description || "No description"}
        action={
          chip && (
            <Chip
              label={chip.toUpperCase()}
              size="small"
              variant="outlined"
              color={chipColor}
            />
          )
        }
        sx={{ mb: 0 }}
      />
      <CardContent sx={{ flexGrow: 1, pb: 1.5 }}>
        <Divider sx={{ mb: 1.5 }} />
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
          }}
        >
          {entityFields}
        </Box>
        <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
          {labels.map((label) => (
            <Chip key={label} label={label} size="small" />
          ))}
        </Box>
      </CardContent>
      <CardActions sx={{ pt: 0, px: 2 }}>
        <Box
          sx={{
            display: "flex",
            gap: 1,
            width: "100%",
            justifyContent: "center",
          }}
        >
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate(detailsUrl)}
            sx={{ flex: 1 }}
          >
            View Details
          </Button>
          {createButtonName && (
            <PermissionWrapper
              requiredPermission={`api:${entity_name}`}
              permissionAction="write"
            >
              <Button
                size="small"
                variant="contained"
                onClick={handleCreateClick}
                sx={{ flex: 1 }}
              >
                {createButtonName}
              </Button>
            </PermissionWrapper>
          )}
        </Box>
      </CardActions>
    </Card>
  );
};
