import { useCallback } from "react";

import { useConfig } from "../../common";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { Button } from "../../ui";
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
      className="mt-8"
      actions={
        <Button variant="contained" onClick={handlePermissionReload}>
          Reload
        </Button>
      }
    />
  );
};
