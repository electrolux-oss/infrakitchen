import { UserShort } from "../users";

export type NotificationChannel = "IN_APP" | "SLACK";

export interface NotificationSubscriptionRow {
  id: string;
  entity_type: string;
  entity_id: string | null;
  user: UserShort | null;
  created_at?: Date;
  updated_at?: Date;
  entity_data?: {
    name?: string;
  };
}

export interface NotificationPreferenceRow {
  id: string;
  event_type: string;
  channels: NotificationChannel[];
  user: UserShort | null;
  created_at?: Date;
  updated_at?: Date;
}
