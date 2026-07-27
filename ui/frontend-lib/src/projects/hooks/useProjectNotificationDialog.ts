import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import {
  CREATE_PROJECT_SUBSCRIPTION_MUTATION,
  DELETE_PROJECT_SUBSCRIPTION_MUTATION,
} from "../../notifications";
import { GqlNotificationSubscription } from "../../notifications/graphql";

export interface UseProjectNotificationDialogProps {
  projectId: string;
  onSubscriptionChange?: () => void;
}

export const useProjectNotificationDialog = ({
  projectId,
  onSubscriptionChange,
}: UseProjectNotificationDialogProps) => {
  const { ikApi, currentUser } = useConfig();
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  const isSubscribed = subscriptions.length > 0;

  const loadState = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setLoading(true);
    try {
      if (!currentUser?.id) {
        setSubscriptions([]);
        return;
      }

      const response = await ikApi.graphqlRequest<{
        subscriptions: GqlNotificationSubscription[];
      }>(
        `query ProjectSubscriptionState($subscriptionFilter: JSON) {
          subscriptions(filter: $subscriptionFilter) {
            id
          }
        }`,
        {
          subscriptionFilter: {
            user_id: currentUser.id,
            entity_type: "project",
            entity_id: projectId,
          },
        },
      );

      setSubscriptions(
        response.subscriptions.map((subscription) => subscription.id),
      );
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, ikApi, projectId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleSubscribe = async () => {
    if (!projectId || !currentUser?.id) {
      return;
    }

    setLoading(true);
    try {
      await ikApi.graphqlRequest(CREATE_PROJECT_SUBSCRIPTION_MUTATION, {
        input: {
          projectId,
        },
      });

      await loadState();
      onSubscriptionChange?.();
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!currentUser?.id || subscriptions.length === 0) {
      return;
    }

    setLoading(true);
    try {
      await ikApi.graphqlRequest(DELETE_PROJECT_SUBSCRIPTION_MUTATION, {
        input: {
          projectId,
        },
      });

      await loadState();
      onSubscriptionChange?.();
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    isSubscribed,
    handleSubscribe,
    handleUnsubscribe,
  };
};
