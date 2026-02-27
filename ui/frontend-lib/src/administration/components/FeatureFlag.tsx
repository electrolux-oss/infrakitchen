import { useCallback, useEffect, useMemo, useState } from "react";

import { Box, Button, Grid, Stack, Typography } from "@mui/material";

import { useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";

import { FeatureFlagCard, type FeatureFlagDTO } from "./FeatureFlagCard";

export const FeatureFlagSection = () => {
  const { ikApi } = useConfig();
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagDTO[]>([]);
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchFeatureFlags = useCallback(async () => {
    try {
      setLoading(true);
      const result = await ikApi.get("feature_flags");
      if (result.status === "ok") {
        setFeatureFlags(result.data);
      }
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
        ikApi.patchRaw("feature_flags", {
          name: flagName,
          enabled,
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
      await ikApi.postRaw("feature_flags/reload", {});
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
    <Box
      sx={{
        mt: 4,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        p: 3,
        position: "relative",
      }}
    >
      <Box sx={{ mb: 3 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1 }}
        >
          <Typography variant="h5" component="h2" gutterBottom>
            Feature Flags
          </Typography>
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
              variant="outlined"
              size="medium"
              onClick={handleFeatureFlagReload}
              disabled={loading}
            >
              Reload
            </Button>
          </Stack>
        </Stack>
        <Typography variant="body2" color="textSecondary">
          Manage application feature toggles and configuration settings
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {featureFlags.map((flag) => (
          <Grid
            key={flag.name}
            size={{
              xs: 12,
              sm: 6,
              md: 4,
              lg: 4,
            }}
            sx={{ display: "flex" }}
          >
            <FeatureFlagCard
              flagName={flag.name}
              displayName={flag.name}
              featureFlags={featureFlags}
              loading={loading}
              onToggle={handleFeatureFlagToggle}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
