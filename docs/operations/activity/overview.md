# Activity

The **Activity** interface provides visibility into entity history, operations, and changes in InfraKitchen. Every entity has an Activity view accessible via the **Activity** button, offering three complementary perspectives on what happened, who did it, and how the entity evolved.

## 📊 Activity Views

The Activity tab combines three distinct but interconnected views:

| View                          | Purpose                                 | Availability                          |
| ----------------------------- | --------------------------------------- | ------------------------------------- |
| **[Audit](audit.md)**         | Track user actions and events           | All entities                          |
| **[Logs](logs.md)**           | View operation output in real-time      | Entities that execute operations      |
| **[Revisions](revisions.md)** | Compare configuration changes over time | Entities with versioned configuration |

---

## 🔍 Accessing Activity

**From any entity:**

1. Navigate to the entity (resource, template, integration, etc.)
2. Click the **Activity** button
3. Select the desired tab (Audit, Logs, or Revisions)

**Global audit log:**

- Navigate to **Administration** → **Audit Log** for system-wide visibility
