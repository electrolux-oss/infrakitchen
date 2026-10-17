import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import {
  CREATE_RESOURCE_SUBSCRIPTION_MUTATION,
  DELETE_RESOURCE_SUBSCRIPTION_MUTATION,
} from "../../notifications";
import { GqlNotificationSubscription } from "../../notifications/graphql";

export interface UseResourceNotificationDialogProps {
  resourceId: string;
  onSubscriptionChange?: () => void;
}

export const useResourceNotificationDialog = ({
  resourceId,
  onSubscriptionChange,
}: UseResourceNotificationDialogProps) => {
  const { ikApi, currentUser } = useConfig();
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  const isSubscribed = subscriptions.length > 0;

  const loadState = useCallback(async () => {
    if (!resourceId) {
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
        `query ResourceSubscriptionState($subscriptionFilter: JSON) {
          subscriptions(filter: $subscriptionFilter) {
            id
          }
        }`,
        {
          subscriptionFilter: {
            user_id: currentUser.id,
            entity_type: "resource",
            entity_id: resourceId,
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
  }, [ikApi, resourceId, currentUser?.id]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleSubscribe = async (inheritChildren: boolean = false) => {
    if (!resourceId || !currentUser?.id) {
      return;
    }

    setLoading(true);
    try {
      await ikApi.graphqlRequest(CREATE_RESOURCE_SUBSCRIPTION_MUTATION, {
        input: {
          resourceId,
          inheritChildren,
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

  const handleUnsubscribe = async (inheritChildren: boolean = false) => {
    if (!currentUser?.id || subscriptions.length === 0) {
      return;
    }

    setLoading(true);
    try {
      await ikApi.graphqlRequest(DELETE_RESOURCE_SUBSCRIPTION_MUTATION, {
        input: {
          resourceId,
          inheritChildren,
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
