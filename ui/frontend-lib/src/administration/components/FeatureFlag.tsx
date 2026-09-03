import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Divider, Grid, Stack } from "@mui/material";

import { useConfig } from "../../common";
import { BaseCard } from "../../common/components/BaseCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  FEATURE_FLAGS_QUERY,
  RELOAD_FEATURE_FLAGS_MUTATION,
  UPDATE_FEATURE_FLAG_MUTATION,
} from "../graphql";

import { FeatureFlagRow, type FeatureFlagDTO } from "./FeatureFlagRow";

// Feature flags are backend config keys and the backend exposes no description
// field, so human-readable copy lives here keyed by flag name. Flags added to
// the backend's default configs without a mapping render without a description.
const FEATURE_FLAG_DESCRIPTIONS: Record<string, string> = {
  "Approval Flow":
    "When enabled, resource applies and destroys require human approval.",
  "Demo Mode":
    "When enabled, applies and destroys are skipped so no real changes are made.",
  Websocket:
    "When enabled, real-time events and logs stream over WebSocket subscriptions.",
};

export const FeatureFlagSection = () => {
  const { ikApi } = useConfig();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagDTO[]>([]);
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchFeatureFlags = useCallback(async () => {
    try {
      setLoading(true);
      const result = await ikApi.graphqlRequest<{
        featureFlags: FeatureFlagDTO[];
      }>(FEATURE_FLAGS_QUERY);
      setFeatureFlags(result.featureFlags);
    } catch (error: any) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi]);

  useEffect(() => {
    fetchFeatureFlags();
  }, [fetchFeatureFlags]);

  const handleFeatureFlagToggle = (flagName: string, enabled: boolean) => {
    setChanges((prev) => ({
      ...prev,
      [flagName]: enabled,
    }));
  };

  const handleSaveAll = async () => {
    try {
      setLoading(true);

      const promises = Object.entries(changes).map(([flagName, enabled]) =>
        ikApi.graphqlRequest(UPDATE_FEATURE_FLAG_MUTATION, {
          input: {
            name: flagName,
            enabled,
          },
        }),
      );

      await Promise.all(promises);

      setFeatureFlags((prev) =>
        prev.map((flag) =>
          Object.hasOwn(changes, flag.name)
            ? { ...flag, enabled: changes[flag.name] }
            : flag,
        ),
      );

      setChanges({});
      notify("Feature flags updated successfully", "success");
    } catch (error: any) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    return Object.entries(changes).some(([flagName, newValue]) => {
      const originalFlag = featureFlags.find((flag) => flag.name === flagName);
      return originalFlag && originalFlag.enabled !== newValue;
    });
  }, [changes, featureFlags]);

  const handleFeatureFlagReload = async () => {
    try {
      setLoading(true);
      await ikApi.graphqlRequest(RELOAD_FEATURE_FLAGS_MUTATION);
      await fetchFeatureFlags();
      setChanges({});
      notify("Feature flags reloaded successfully", "success");
    } catch (error: any) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseCard
      name="Feature Flags"
      description="Manage application feature toggles and configuration settings"
      sx={{ mt: 4 }}
      actions={
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            size="medium"
            onClick={handleSaveAll}
            disabled={loading || !hasUnsavedChanges}
          >
            Save
          </Button>
          <Button
            size="medium"
            onClick={handleFeatureFlagReload}
            disabled={loading}
          >
            Reload
          </Button>
        </Stack>
      }
    >
      <Grid size={{ xs: 12 }}>
        <Stack divider={<Divider />}>
          {featureFlags.map((flag) => (
            <FeatureFlagRow
              key={flag.name}
              flagName={flag.name}
              displayName={flag.name}
              description={FEATURE_FLAG_DESCRIPTIONS[flag.name]}
              featureFlags={featureFlags}
              loading={loading}
              onToggle={handleFeatureFlagToggle}
            />
          ))}
        </Stack>
      </Grid>
    </BaseCard>
  );
};
