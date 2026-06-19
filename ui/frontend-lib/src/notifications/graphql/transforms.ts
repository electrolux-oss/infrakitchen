import { GqlUserShort } from "../../users/graphql";
import { NotificationChannel } from "../types";

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
    entityName?: string;
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
