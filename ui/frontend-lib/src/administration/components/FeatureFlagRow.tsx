import React, { useState } from "react";

import { Box, Switch, Tooltip, Typography } from "@mui/material";

import { Label } from "../../common/components/labels/Label";

export interface FeatureFlagDTO {
  name: string;
  configName: string;
  enabled: boolean;
  updatedBy?: string | null;
}

interface FeatureFlagRowProps {
  flagName: string;
  displayName: string;
  description?: string;
  experimental?: boolean;
  featureFlags: FeatureFlagDTO[];
  loading: boolean;
  onToggle?: (flagName: string, enabled: boolean, displayName?: string) => void;
}

export const FeatureFlagRow: React.FC<FeatureFlagRowProps> = ({
  flagName,
  displayName,
  description,
  experimental = false,
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
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        py: 1,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle2" sx={{ color: "text.primary" }}>
            {displayName}
          </Typography>
          {experimental && (
            <Tooltip title="This feature is still being tested and may change or be removed.">
              <Label label="Experimental" />
            </Tooltip>
          )}
        </Box>
        {description && (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {description}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center" }}>
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
    </Box>
  );
};
