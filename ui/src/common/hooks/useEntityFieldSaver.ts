import { useCallback } from "react";

import { useConfig } from "../context";
import { useEntityProvider } from "../context/EntityContext";

import { notify, notifyError } from "./useNotification";

/**
 * Saves a partial update of the current entity with its `update` mutation
 * (called as `{ id, input }`), shows a success toast and refreshes the entity.
 * On failure it shows the error and rethrows, so inline editors stay open.
 */
export function useEntityFieldSaver<I>(
  mutation: string,
  id: string | number,
  /** Entity name for the toast, e.g. "Secret" → "Secret updated successfully". */
  label: string,
) {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();

  return useCallback(
    async (input: I) => {
      try {
        await ikApi.graphqlRequest(mutation, { id, input });
        notify(`${label} updated successfully`, "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, mutation, id, label, refreshEntity],
  );
}
