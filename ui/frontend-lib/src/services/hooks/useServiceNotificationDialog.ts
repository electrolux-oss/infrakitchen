import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import { GqlNotificationSubscription } from "../../notifications/graphql";
import {
  CREATE_SERVICE_SUBSCRIPTION_MUTATION,
  DELETE_SERVICE_SUBSCRIPTION_MUTATION,
} from "../graphql/mutations";

export interface UseServiceNotificationDialogProps {
  serviceId: string;
  onSubscriptionChange?: () => void;
}

export const useServiceNotificationDialog = ({
  serviceId,
  onSubscriptionChange,
}: UseServiceNotificationDialogProps) => {
  const { ikApi, currentUser } = useConfig();
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  const isSubscribed = subscriptions.length > 0;

  const loadState = useCallback(async () => {
    if (!serviceId) {
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
        `query ServiceSubscriptionState($subscriptionFilter: JSON) {
          subscriptions(filter: $subscriptionFilter) {
            id
          }
        }`,
        {
          subscriptionFilter: {
            user_id: currentUser.id,
            entity_type: "service",
            entity_id: serviceId,
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
  }, [currentUser?.id, ikApi, serviceId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleSubscribe = async () => {
    if (!serviceId || !currentUser?.id) {
      return;
    }

    setLoading(true);
    try {
      await ikApi.graphqlRequest(CREATE_SERVICE_SUBSCRIPTION_MUTATION, {
        input: {
          serviceId,
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
      await ikApi.graphqlRequest(DELETE_SERVICE_SUBSCRIPTION_MUTATION, {
        input: {
          serviceId,
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
