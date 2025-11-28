import { useEffect, useState, useCallback } from "react";

import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
} from "@mui/material";

import { useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { FeatureFlagCard, FeatureFlagDTO } from "../components";

export const AdminPage = () => {
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
          enabled: enabled,
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

  const hasUnsavedChanges = () => {
    return Object.entries(changes).some(([flagName, newValue]) => {
      const originalFlag = featureFlags.find((flag) => flag.name === flagName);
      return originalFlag && originalFlag.enabled !== newValue;
    });
  };

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

  const handlePermissionReload = () => {
    ikApi
      .postRaw("administration/reload_permissions", {})
      .then(() => {
        notify("Permissions reloaded successfully", "info");
      })
      .catch((error) => {
        notifyError(error);
      });
  };

  return (
    <PageContainer
      title="Administration"
      bottomActions={
        <>
          <Button
            variant="contained"
            size="medium"
            onClick={handleSaveAll}
            disabled={loading || !hasUnsavedChanges()}
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
        </>
      }
    >
      <Box sx={{ width: "100%", maxWidth: 1200 }}>
        <Box
          sx={{
            mt: 4,
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            p: 3,
          }}
        >
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              Permission Configurations
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid
              size={{
                xs: 12,
                sm: 6,
                md: 3,
              }}
            >
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
                      Reload Permissions
                    </Typography>
                    <Button
                      onClick={() => handlePermissionReload()}
                      variant="contained"
                      size="small"
                      sx={{ ml: 2 }}
                    >
                      Reload
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

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
            <Typography variant="h5" component="h2" gutterBottom>
              Feature Flags
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Manage application feature toggles and configuration settings
            </Typography>
          </Box>

          <Grid container spacing={2} sx={{ mb: 8 }}>
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
      </Box>
    </PageContainer>
  );
};

AdminPage.path = "/admin";
