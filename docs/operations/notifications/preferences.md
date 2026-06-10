# Notification Preferences

Notification Preferences let you control which event types trigger notifications and which delivery channels are used. Each preference maps one event type to one or more channels. InfraKitchen checks your preferences every time an event fires on an entity you are subscribed to.

## 📝 Overview

A **Notification Preference** answers the question: *"When event X happens, how should I be notified?"*

You can have multiple preferences — one per event type — and each can enable different channel combinations. If no preference exists for an event type, that event will not generate a notification for you even if you are subscribed to the entity.

!!! tip "Preferences and Subscriptions work together"
    Preferences define the rules; [Subscriptions](subscriptions.md) define the scope. Both must be in place to receive a notification.

---

## 👁️ Viewing Your Preferences

1. Navigate to your **User Profile**
2. Scroll to the **Notification Preferences** card
3. The table shows all your configured preferences with their event type, enabled channels, and creation date

---

## ➕ Adding a Notification Preference

1. In the **Notification Preferences** card, click **Add Preference**
2. A dialog opens with two fields:
   - **Event Type** — Select the infrastructure event you want to be notified about
   - **Integration Type** — Check one or more delivery channels
3. Click **Create**

### Event Types

| Event Type | Description |
|---|---|
| `create` | An entity was created |
| `update` | An entity was modified |
| `destroy` | Resource infrastructure was destroyed |
| `execute` | An operation was executed on an entity |
| `sync` | An entity was synchronized |

### Delivery Channels

| Channel | Description |
|---|---|
| **IN_APP** | Notification appears inside the InfraKitchen UI |
| **SLACK** | Notification is sent to Slack via the configured [Slack integration](../../integrations/notifications/slack.md) |

!!! info "At least one channel required"
    You must select at least one delivery channel when creating or editing a preference. A preference with no channels cannot be saved.

---

## ✏️ Editing a Preference

1. In the **Notification Preferences** table, click **Edit** on the row you want to change
2. Update the **Event Type** or **Integration Type** selections
3. Click **Save**

!!! note "Edit behaviour"
    Editing a preference deletes the existing record and creates a new one. The creation timestamp will reflect the edit time.

---

## 🗑️ Deleting a Preference

1. In the **Notification Preferences** table, click **Delete** on the row you want to remove
2. Click **Confirm**

After deletion, events of that type will no longer generate notifications for you, regardless of your active subscriptions.

---

## 📋 Preference Properties

| Property | Description |
|---|---|
| **Event Type** | The event that triggers the notification (e.g., `update`, `execute`) |
| **Channels** | The delivery channels enabled for this preference |
| **User** | The user who owns this preference |
| **Created At** | When the preference was created |
