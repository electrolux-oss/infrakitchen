import { useCallback, useState } from "react";

import { useConfig, useEntityProvider } from "../context";
import { buildEntityActionMutation } from "../graphql/entityActionMutation";

import { notify, notifyError } from "./useNotification";

const entityLabel = (entityName?: string) => {
  const name = entityName || "Resource";
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/**
 * Runs an action (apply, plan, drift check, ...) on the entity of the
 * surrounding EntityProvider and merges the returned status into it.
 * `runAction` resolves to whether the action was queued.
 */
export const useEntityAction = () => {
  const { ikApi } = useConfig();
  const { entity, refreshEntity } = useEntityProvider();
  const [loading, setLoading] = useState(false);

  const runAction = useCallback(
    async (action: string): Promise<boolean> => {
      if (!entity?.id || !entity?.entityName) {
        notifyError(
          new Error(
            `${entityLabel(entity?.entityName)} ${action} error: no record id`,
          ),
        );
        return false;
      }
      setLoading(true);
      try {
        const response = await ikApi.graphqlRequest<{
          [key: string]: { id: string; status: string; entityName: string };
        }>(buildEntityActionMutation(entity.entityName), {
          id: entity.id,
          input: { action },
        });
        const result = Object.values(response)[0];
        notify(
          `${entityLabel(result.entityName)} ${action} task sent successfully`,
          "success",
        );
        refreshEntity?.({
          ...entity,
          ...result,
          entityName: entity.entityName,
        });
        return true;
      } catch (error) {
        notifyError(error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [entity, ikApi, refreshEntity],
  );

  return { runAction, loading };
};
