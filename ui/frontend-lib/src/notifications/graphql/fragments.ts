import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const NOTIFICATION_GRAPHQL_FIELDS = {
  subscription: {
    base: ["id", "entityType", "entityId", "createdAt", "updatedAt"] as const,
    relations: {
      user: "user",
    } as const,
  },
  preference: {
    base: ["id", "eventType", "channels", "createdAt", "updatedAt"] as const,
    relations: {
      user: "user",
    } as const,
  },
};

export type NotificationSubscriptionGraphqlBaseField =
  (typeof NOTIFICATION_GRAPHQL_FIELDS.subscription.base)[number];
export type NotificationPreferenceGraphqlBaseField =
  (typeof NOTIFICATION_GRAPHQL_FIELDS.preference.base)[number];
export type NotificationSubscriptionGraphqlRelationKey =
  keyof typeof NOTIFICATION_GRAPHQL_FIELDS.subscription.relations;
export type NotificationPreferenceGraphqlRelationKey =
  keyof typeof NOTIFICATION_GRAPHQL_FIELDS.preference.relations;
export type NotificationSubscriptionGraphqlRelationField =
  (typeof NOTIFICATION_GRAPHQL_FIELDS.subscription.relations)[NotificationSubscriptionGraphqlRelationKey];
export type NotificationPreferenceGraphqlRelationField =
  (typeof NOTIFICATION_GRAPHQL_FIELDS.preference.relations)[NotificationPreferenceGraphqlRelationKey];

export const NOTIFICATION_SUBSCRIPTION_FIELDS = `
  ${buildSelection(NOTIFICATION_GRAPHQL_FIELDS.subscription.base)}
  ${buildNestedSelection(NOTIFICATION_GRAPHQL_FIELDS.subscription.relations.user, USER_SHORT_FIELDS)}
`;

export const NOTIFICATION_PREFERENCE_FIELDS = `
  ${buildSelection(NOTIFICATION_GRAPHQL_FIELDS.preference.base)}
  ${buildNestedSelection(NOTIFICATION_GRAPHQL_FIELDS.preference.relations.user, USER_SHORT_FIELDS)}
`;

/** Maps snake_case table column fields to their GraphQL selection strings. */
export const NOTIFICATION_SUBSCRIPTION_FIELD_MAP: GraphqlFieldMap = {
  entity_type: "entityType",
  entity_id: "entityId",
  created_at: "createdAt",
  updated_at: "updatedAt",
  user: buildNestedSelection(
    NOTIFICATION_GRAPHQL_FIELDS.subscription.relations.user,
    USER_SHORT_FIELDS,
  ),
};

export const NOTIFICATION_PREFERENCE_FIELD_MAP: GraphqlFieldMap = {
  event_type: "eventType",
  created_at: "createdAt",
  updated_at: "updatedAt",
  user: buildNestedSelection(
    NOTIFICATION_GRAPHQL_FIELDS.preference.relations.user,
    USER_SHORT_FIELDS,
  ),
};
