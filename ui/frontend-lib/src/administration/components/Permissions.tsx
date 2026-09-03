import { useCallback } from "react";

import { Button } from "@mui/material";

import { useConfig } from "../../common";
import { BaseCard } from "../../common/components/BaseCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { RELOAD_PERMISSIONS_MUTATION } from "../graphql";

export const PermissionsSection = () => {
  const { ikApi } = useConfig();

  const handlePermissionReload = useCallback(() => {
    ikApi
      .graphqlRequest(RELOAD_PERMISSIONS_MUTATION)
      .then(() => {
        notify("Permissions reloaded successfully", "info");
      })
      .catch((error) => {
        notifyError(error);
      });
  }, [ikApi]);

  return (
    <BaseCard
      name="Permission Configurations"
      description="Reload permission definitions from the backend when they change"
      sx={{ mt: 4 }}
      actions={
        <Button variant="contained" onClick={handlePermissionReload}>
          Reload
        </Button>
      }
    />
  );
};
