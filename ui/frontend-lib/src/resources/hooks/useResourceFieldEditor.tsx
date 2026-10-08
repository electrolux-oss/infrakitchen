import { ReactNode, useCallback } from "react";

import { Box } from "@mui/material";

import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { PendingChangeBadge } from "../../common/components/labels/PendingChangeBadge";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  GqlResource,
  ResourceUpdateFieldInput,
  UPDATE_RESOURCE_MUTATION,
} from "../graphql";

/**
 * Shared inline-editing helpers for the resource detail page (sidebar fields
 * and the variables editor) so they check permissions, save and flag pending
 * changes the same way.
 */
export const useResourceFieldEditor = (resource: GqlResource) => {
  const { ikApi } = useConfig();
  const { refreshEntity, userEntityPermissions, actions, hasPendingChange } =
    useEntityProvider();
  const canEdit =
    userEntityPermissions.includes("write") || actions.includes("edit");

  const saveField = useCallback(
    async (input: ResourceUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_RESOURCE_MUTATION, {
          id: resource.id,
          input,
        });
        notify("Resource updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, resource.id, refreshEntity],
  );

  const withPendingChange = useCallback(
    (display: ReactNode, key: string) => {
      if (!hasPendingChange(key)) {
        return display;
      }

      const isEmptyDisplay =
        display === null || display === undefined || display === "";

      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 1,
          }}
        >
          {isEmptyDisplay ? <PlaceholderText /> : display}
          <PendingChangeBadge />
        </Box>
      );
    },
    [hasPendingChange],
  );

  return { canEdit, saveField, withPendingChange };
};
