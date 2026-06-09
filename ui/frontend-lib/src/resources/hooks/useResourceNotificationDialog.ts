import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import {
  CREATE_RESOURCE_SUBSCRIPTION_MUTATION,
  CURRENT_USER_NOTIFICATION_QUERY,
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
  const { ikApi } = useConfig();
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  const isSubscribed = subscriptions.length > 0;

  const loadState = useCallback(async () => {
    if (!resourceId) {
      return;
    }

    setLoading(true);
    try {
      const userResponse = await ikApi.graphqlRequest<{
        currentUser: { id: string; identifier: string } | null;
      }>(CURRENT_USER_NOTIFICATION_QUERY);

      const resolvedUserId = userResponse.currentUser?.id || null;
      setCurrentUserId(resolvedUserId);

      if (!resolvedUserId) {
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
            user_id: resolvedUserId,
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
  }, [ikApi, resourceId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleSubscribe = async (inheritChildren: boolean = false) => {
    if (!resourceId || !currentUserId) {
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
    if (!currentUserId || subscriptions.length === 0) {
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
