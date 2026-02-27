import { useCallback } from "react";

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

export const PermissionsSection = () => {
  const { ikApi } = useConfig();

  const handlePermissionReload = useCallback(() => {
    ikApi
      .postRaw("administration/reload_permissions", {})
      .then(() => {
        notify("Permissions reloaded successfully", "info");
      })
      .catch((error) => {
        notifyError(error);
      });
  }, [ikApi]);

  return (
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
                  onClick={handlePermissionReload}
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
  );
};
