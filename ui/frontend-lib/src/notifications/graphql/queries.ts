import {
  NOTIFICATION_PREFERENCE_FIELDS,
  NOTIFICATION_SUBSCRIPTION_FIELDS,
} from "./fragments";

export const CURRENT_USER_NOTIFICATION_QUERY = `
  query CurrentUserNotificationContext {
    currentUser {
      id
      identifier
    }
  }
`;

export const RESOURCE_NOTIFICATION_STATE_QUERY = `
  query ResourceNotificationState($subscriptionFilter: JSON, $preferenceFilter: JSON) {
    subscriptions(filter: $subscriptionFilter) {
      ${NOTIFICATION_SUBSCRIPTION_FIELDS}
    }
    notificationPreferences(filter: $preferenceFilter) {
      ${NOTIFICATION_PREFERENCE_FIELDS}
    }
  }
`;

export const CREATE_SUBSCRIPTION_MUTATION = `
  mutation CreateSubscription($input: SubscriptionCreateInput!) {
    createSubscription(input: $input) {
      id
    }
  }
`;

export const DELETE_SUBSCRIPTION_MUTATION = `
  mutation DeleteSubscription($id: UUID!) {
    deleteSubscription(id: $id)
  }
`;

export const CREATE_NOTIFICATION_PREFERENCE_MUTATION = `
  mutation CreateNotificationPreference($input: NotificationPreferenceCreateInput!) {
    createNotificationPreference(input: $input) {
      id
      eventType
      channels
    }
  }
`;

export const DELETE_NOTIFICATION_PREFERENCE_MUTATION = `
  mutation DeleteNotificationPreference($id: UUID!) {
    deleteNotificationPreference(id: $id)
  }
`;

export const CREATE_RESOURCE_SUBSCRIPTION_MUTATION = `
  mutation CreateResourceSubscription($input: ResourceSubscriptionCreateInput!) {
    createResourceSubscription(input: $input) {
      id
    }
  }
`;

export const DELETE_RESOURCE_SUBSCRIPTION_MUTATION = `
  mutation DeleteResourceSubscription($input: ResourceSubscriptionDeleteInput!) {
    deleteResourceSubscription(input: $input)
  }
`;
