import { GqlUserShort, transformUserShort } from "../../users/graphql";
import {
  NotificationChannel,
  NotificationPreferenceRow,
  NotificationSubscriptionRow,
} from "../types";

import type {
  NotificationPreferenceGraphqlBaseField,
  NotificationPreferenceGraphqlRelationField,
  NotificationSubscriptionGraphqlBaseField,
  NotificationSubscriptionGraphqlRelationField,
} from "./fragments";

type GqlNotificationSubscriptionFieldTypes = {
  id: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  updatedAt: string;
};

type GqlNotificationSubscriptionRelationFieldTypes = {
  user: GqlUserShort | null;
};

type GqlNotificationSubscriptionTypes = GqlNotificationSubscriptionFieldTypes &
  GqlNotificationSubscriptionRelationFieldTypes;

export type GqlNotificationSubscription = Pick<
  GqlNotificationSubscriptionTypes,
  | NotificationSubscriptionGraphqlBaseField
  | NotificationSubscriptionGraphqlRelationField
> & {
  entityData?: {
    name?: string;
    id?: string;
    _entity_name?: string;
  };
};

type GqlNotificationPreferenceFieldTypes = {
  id: string;
  eventType: string;
  channels: NotificationChannel[];
  createdAt: string;
  updatedAt: string;
};

type GqlNotificationPreferenceRelationFieldTypes = {
  user: GqlUserShort | null;
};

type GqlNotificationPreferenceTypes = GqlNotificationPreferenceFieldTypes &
  GqlNotificationPreferenceRelationFieldTypes;

export type GqlNotificationPreference = Pick<
  GqlNotificationPreferenceTypes,
  | NotificationPreferenceGraphqlBaseField
  | NotificationPreferenceGraphqlRelationField
>;

export function transformNotificationSubscription(
  gql: GqlNotificationSubscription,
): NotificationSubscriptionRow {
  return {
    id: gql.id,
    entity_type: gql.entityType,
    entity_id: gql.entityId,
    user: gql.user ? transformUserShort(gql.user) : null,
    created_at: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updated_at: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    entity_data: gql.entityData,
  };
}

export function transformNotificationPreference(
  gql: GqlNotificationPreference,
): NotificationPreferenceRow {
  return {
    id: gql.id,
    event_type: gql.eventType,
    channels: gql.channels || [],
    user: gql.user ? transformUserShort(gql.user) : null,
    created_at: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updated_at: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
  };
}
