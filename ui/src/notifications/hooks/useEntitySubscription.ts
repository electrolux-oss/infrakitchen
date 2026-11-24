import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import {
  CREATE_SUBSCRIPTION_MUTATION,
  DELETE_SUBSCRIPTION_MUTATION,
  GqlNotificationSubscription,
} from "../graphql";

export interface UseEntitySubscriptionProps {
  /** Subscription entity type, e.g. "executor". */
  entityType: string;
  entityId: string;
  onSubscriptionChange?: () => void;
}

/**
 * The current user's direct subscription to one entity, through the generic
 * subscription mutations. Entities with their own subscription mutations
 * (resources with children, projects, services) use dedicated hooks.
 */
export const useEntitySubscription = ({
  entityType,
  entityId,
  onSubscriptionChange,
}: UseEntitySubscriptionProps) => {
  const { ikApi, currentUser } = useConfig();
  const [loading, setLoading] = useState(false);
  const [subscriptionIds, setSubscriptionIds] = useState<string[]>([]);

  const isSubscribed = subscriptionIds.length > 0;

  const loadState = useCallback(async () => {
    if (!entityId) {
      return;
    }

    setLoading(true);
    try {
      if (!currentUser?.id) {
        setSubscriptionIds([]);
        return;
      }

      const response = await ikApi.graphqlRequest<{
        subscriptions: GqlNotificationSubscription[];
      }>(
        `query EntitySubscriptionState($subscriptionFilter: JSON) {
          subscriptions(filter: $subscriptionFilter) {
            id
          }
        }`,
        {
          subscriptionFilter: {
            user_id: currentUser.id,
            entity_type: entityType,
            entity_id: entityId,
          },
        },
      );

      setSubscriptionIds(
        response.subscriptions.map((subscription) => subscription.id),
      );
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, entityId, entityType, ikApi]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleSubscribe = async () => {
    if (!entityId || !currentUser?.id || isSubscribed) {
      return;
    }

    setLoading(true);
    try {
      await ikApi.graphqlRequest(CREATE_SUBSCRIPTION_MUTATION, {
        input: { entityType, entityId },
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
    if (!currentUser?.id || subscriptionIds.length === 0) {
      return;
    }

    setLoading(true);
    try {
      for (const id of subscriptionIds) {
        await ikApi.graphqlRequest(DELETE_SUBSCRIPTION_MUTATION, { id });
      }

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
