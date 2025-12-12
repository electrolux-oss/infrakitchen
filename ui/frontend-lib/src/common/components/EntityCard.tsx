import { ReactNode } from "react";

import { useNavigate } from "react-router";

import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Divider,
  CardActions,
  Button,
} from "@mui/material";

import StatusChip from "../../common/StatusChip";
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
  status,
  entity_name,
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
      <CardContent sx={{ flexGrow: 1, pb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h5"
              component="h2"
              sx={{
                whiteSpace: "normal",
                overflow: "visible",
                textOverflow: "unset",
                wordBreak: "break-word",
              }}
            >
              {name}
            </Typography>
          </Box>
          {status && <StatusChip status={status} />}
        </Box>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {description || "No description"}
        </Typography>
        <Divider sx={{ my: 1.5 }} />
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
