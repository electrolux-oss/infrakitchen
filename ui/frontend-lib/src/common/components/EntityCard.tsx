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
}: EntityCardProps) => {
  const navigate = useNavigate();

  const handleCreateClick = () => {
    if (onCreateClick) {
      onCreateClick();
    } else if (createUrl) {
      navigate(createUrl);
    }
  };

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardHeader
        avatar={icon}
        title={name}
        subheader={description || "No description"}
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
        <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            onClick={() => navigate(detailsUrl)}
          >
            View Details
          </Button>
          {createButtonName && (
            <PermissionWrapper
              requiredPermission={`api:${entity_name}`}
              permissionAction="write"
            >
              <Button
                fullWidth
                size="small"
                variant="contained"
                onClick={handleCreateClick}
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
