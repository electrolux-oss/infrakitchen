# Subscriptions

Subscriptions allow you to follow specific entities in InfraKitchen and receive notifications when events occur on them. When you subscribe to a resource, any activity on that resource — provisioning, updates, destruction — can trigger a notification delivered through your configured channels.

## 📝 Overview

A **Subscription** ties a user to an entity. InfraKitchen checks subscriptions every time an event occurs to determine who should be notified. Subscriptions are scoped to a single entity and are independent of notification preferences — you need both to receive a notification.

!!! tip "Subscriptions and Preferences work together"
    Subscribing to an entity is necessary but not sufficient. You also need a [Notification Preference](preferences.md) that covers the event type. Without a matching preference, no notification is sent even if you are subscribed.

---

## 👁️ Viewing Your Subscriptions

Access your active subscriptions from your user profile:

1. Navigate to your **User Profile**
2. Scroll to the **User Subscriptions** card
3. The table lists all entities you are currently subscribed to, with the entity link and subscription date

---

## ➕ Subscribing to a Resource

Subscribe to a resource directly from the resource page:

1. Navigate to the resource you want to follow
2. Click the **Subscribe** (bell) button in the resource header
3. A popover appears with subscription options:
   - Optionally check **Include child resources** to also subscribe to all resources nested under this resource
4. Click **Confirm** to subscribe

After subscribing, the bell icon becomes active to indicate you are following the resource.

---

## ➕ Subscribing with Child Inheritance

When you check **Include child resources** before confirming:

- InfraKitchen subscribes you to the selected resource **and** all of its child resources in one operation.
- This is useful when you want visibility into an entire subtree (e.g., a project and all resources beneath it) without manually subscribing to each one.

---

## ➖ Unsubscribing from a Resource

1. Navigate to the resource page
2. Click the active **Unsubscribe** (bell) button
3. The same popover appears — optionally check **Include child resources** to remove all child subscriptions at once
4. Click **Confirm**

---

## 🗑️ Deleting a Subscription from Your Profile

To remove an individual subscription:

1. Navigate to your **User Profile** → **User Subscriptions** card
2. Click **Delete** next to the subscription you want to remove
3. Confirm the deletion

---

## 👥 Viewing Resource Subscribers (Platform Engineers)

Platform engineers can see who is subscribed to a specific resource:

1. Navigate to the resource
2. Click the **Activity** button
3. The **Subscribers** tab lists all users subscribed to that resource, including their subscription date

---

## 📋 Subscription Properties

| Property | Description |
|---|---|
| **Entity Type** | The type of entity being followed (e.g., `resource`) |
| **Entity ID** | The unique identifier of the subscribed entity |
| **User** | The user who owns this subscription |
| **Created At** | When the subscription was created |
