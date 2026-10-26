import React, { useState } from "react";

import { Switch, Tooltip } from "../../ui";
import { Label } from "../../ui/Label";
import { cn } from "../../utils/cn";

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
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h6 className="m-0 text-subtitle2 text-fg">{displayName}</h6>
          {experimental && (
            <Tooltip title="This feature is still being tested and may change or be removed.">
              <Label label="Experimental" />
            </Tooltip>
          )}
        </div>
        {description && (
          <span className="text-caption text-fg-muted">{description}</span>
        )}
      </div>
      <div className="flex items-center">
        <Switch
          checked={getCurrentStatus()}
          onChange={handleToggle}
          disabled={loading}
          inputProps={{ "aria-label": `Toggle ${displayName} feature flag` }}
        />
        <p
          className={cn(
            "m-0 text-body2",
            getCurrentStatus() ? "text-success" : "text-fg-muted",
            "min-w-15 font-medium",
          )}
        >
          {getCurrentStatus() ? "Enabled" : "Disabled"}
        </p>
      </div>
    </div>
  );
};
