import React, { useState } from "react";

import { Box, Switch, Typography, Card, CardContent } from "@mui/material";

export interface FeatureFlagDTO {
  name: string;
  config_name: string;
  enabled: boolean;
}

interface FeatureFlagCardProps {
  flagName: string;
  displayName: string;
  description?: string;
  featureFlags: FeatureFlagDTO[];
  loading: boolean;
  onToggle?: (flagName: string, enabled: boolean, displayName?: string) => void;
}

export const FeatureFlagCard: React.FC<FeatureFlagCardProps> = ({
  flagName,
  displayName,
  featureFlags,
  loading,
  onToggle,
}) => {
  const [localEnabled, setLocalEnabled] = useState<boolean | null>(null);

  const getFeatureFlagStatus = (flagName: string): boolean => {
    const flag = featureFlags.find((flag) => flag.name === flagName);
    return flag?.enabled ?? false;
  };

  const getCurrentStatus = (): boolean => {
    return localEnabled !== null
      ? localEnabled
      : getFeatureFlagStatus(flagName);
  };

  const handleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.checked;
    setLocalEnabled(newValue);
    if (onToggle) {
      onToggle(flagName, newValue, displayName);
    }
  };

  return (
    <Card
      sx={{
        position: "relative",
        width: "fit-content",
        height: "80px",
        display: "flex",
        alignItems: "center",
      }}
    >
      <CardContent
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: "16px !important",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <Typography variant="h6" component="h3">
            {displayName}
          </Typography>
          <Switch
            checked={getCurrentStatus()}
            onChange={handleToggle}
            color="primary"
            disabled={loading}
            slotProps={{
              input: { "aria-label": `Toggle ${displayName} feature flag` },
            }}
          />
          <Typography
            variant="body2"
            sx={{
              color: getCurrentStatus() ? "success.main" : "text.secondary",
              fontWeight: 500,
              minWidth: 60,
            }}
          >
            {getCurrentStatus() ? "Enabled" : "Disabled"}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
