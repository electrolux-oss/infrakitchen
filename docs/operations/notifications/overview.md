# Notifications

The **Notifications** system keeps you informed about infrastructure events across InfraKitchen. It combines two complementary mechanisms: **Subscriptions** that control which entities you follow, and **Notification Preferences** that control how and when you are notified.

## 📊 Notification Components

| Component | Purpose | Configured by |
|---|---|---|
| **[Subscriptions](subscriptions.md)** | Follow specific resources to receive their events | Any user |
| **[Notification Preferences](preferences.md)** | Choose which event types trigger notifications and via which channels | Any user |

---

## 🔔 How Notifications Work

When an event occurs on an entity (e.g., a resource is provisioned, a workflow completes), InfraKitchen:

1. Identifies all users subscribed to that entity
2. Checks each user's **Notification Preferences** to find which channels are enabled for that event type
3. Delivers the notification to each enabled channel (In-App, Slack, etc.)

A user only receives a notification if **both** conditions are met: they have an active subscription to the entity, and they have a preference that matches the event type with at least one channel enabled.

---

## 📡 Delivery Channels

| Channel | Description |
|---|---|
| **IN_APP** | Notifications appear inside the InfraKitchen UI |
| **SLACK** | Notifications are delivered to Slack via a configured [Slack integration](../../integrations/notifications/slack.md) |

!!! info "Setting up Slack notifications"
    Slack delivery requires a Slack integration to be configured in your workspace. See the [Slack Integration Guide](../../integrations/notifications/slack.md) for setup instructions.
