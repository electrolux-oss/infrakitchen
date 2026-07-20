import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfig } from "../../common";
import {
  GqlResourceTempState,
  RESOURCE_TEMP_STATE_BY_RESOURCE_QUERY,
} from "../graphql";

export type ResourcePendingChanges = GqlResourceTempState["value"] | null;

export interface UseResourceTempStateOptions {
  resourceId?: string | null;
  enabled?: boolean;
  refreshKey?: string | number | null;
}

export const useResourceTempState = ({
  resourceId,
  enabled = true,
  refreshKey,
}: UseResourceTempStateOptions) => {
  const { ikApi } = useConfig();
  const [resourceTempState, setResourceTempState] =
    useState<GqlResourceTempState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  const loadState = useCallback(async () => {
    if (!resourceId || !enabled) {
      setResourceTempState(null);
      setError(undefined);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        resourceTempStateByResource: GqlResourceTempState | null;
      }>(RESOURCE_TEMP_STATE_BY_RESOURCE_QUERY, {
        id: resourceId,
      });

      setResourceTempState(response.resourceTempStateByResource ?? null);
      setError(undefined);
    } catch (fetchError) {
      setResourceTempState(null);
      setError(fetchError);
    } finally {
      setLoading(false);
    }
  }, [enabled, ikApi, resourceId]);

  useEffect(() => {
    loadState();
  }, [loadState, refreshKey]);

  const pendingChanges = useMemo(
    () => resourceTempState?.value ?? null,
    [resourceTempState],
  );

  const hasPendingChange = useCallback(
    (key: string) =>
      pendingChanges !== null &&
      Object.prototype.hasOwnProperty.call(pendingChanges, key),
    [pendingChanges],
  );

  return {
    resourceTempState,
    pendingChanges,
    hasPendingChange,
    loading,
    error,
    refetch: loadState,
  };
};

export default useResourceTempState;
