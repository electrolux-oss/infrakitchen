import { ReactNode, useCallback } from "react";

import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { PendingChangeBadge } from "../../common/components/labels/PendingChangeBadge";
import { useEntityProvider } from "../../common/context/EntityContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
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
  const { userEntityPermissions, actions, hasPendingChange } =
    useEntityProvider();
  const canEdit =
    userEntityPermissions.includes("write") || actions.includes("edit");

  const saveField = useEntityFieldSaver<ResourceUpdateFieldInput>(
    UPDATE_RESOURCE_MUTATION,
    resource.id,
    "Resource",
  );

  const withPendingChange = useCallback(
    (display: ReactNode, key: string) => {
      if (!hasPendingChange(key)) {
        return display;
      }

      const isEmptyDisplay =
        display === null || display === undefined || display === "";

      return (
        <div className="flex flex-col items-start gap-2">
          {isEmptyDisplay ? <PlaceholderText /> : display}
          <PendingChangeBadge />
        </div>
      );
    },
    [hasPendingChange],
  );

  return { canEdit, saveField, withPendingChange };
};
