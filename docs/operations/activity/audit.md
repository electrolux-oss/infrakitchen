# Audit Logs

Audit logs provide comprehensive tracking of all user actions and entity changes in InfraKitchen, enabling compliance, security monitoring, and operational transparency.

## 📝 Overview

InfraKitchen automatically records audit logs for every significant action performed on entities within the system. These logs capture who performed an action, what was changed, and when it occurred, providing a complete audit trail for compliance and troubleshooting purposes.

!!! info "Automatic Logging"
    Audit logs are created automatically whenever a user interacts with entities—you don't need to configure anything. All actions are tracked by default.

---

## 📋 Audit Log Structure

Each audit log entry contains the following information:

| Field | Description |
|-------|-------------|
| **Time** | When the action was performed (timestamp) |
| **User** | The user who performed the action (display name and ID) |
| **Event** | The action type (e.g., create, update, execute, approve) |
| **Entity ID** | The unique identifier of the affected entity |
| **Model** | The entity type (e.g., resource, template, integration) |
| **Audit Log ID** | Unique identifier for the audit log entry itself |

---

## 👁️ Viewing Audit Logs

### Global Audit Logs

Access all audit logs across the system from the **Administration** section:

1. Navigate to **Administration** → **Audit Log** in the sidebar
2. View the complete audit trail of all actions
3. Filter by event type using the dropdown
4. Sort by any column (time, user, event)

### Entity-Specific Audit Logs

View audit logs for a specific entity:

1. Navigate to any entity (resource, template, integration, etc.)
2. Click the **Activity** button
3. Select the **Audit** tab
4. View all actions performed on that specific entity

### Event Types

Global audit logs can be filtered by event types:

| Event | Description |
|-------|-------------|
| **create** | Entity was created |
| **update** | Entity was modified |
| **delete** | Entity was deleted |
| **execute** | Action was executed |
| **approve** | Resource change was approved |
| **reject** | Resource change was rejected |
| **destroy** | Resource infrastructure was destroyed |
| **recreate** | Destroyed/rejected resource was recreated |
| **retry** | Failed operation was retried |
| **sync** | Entity was synchronized |
| **enable** | Entity was enabled |
| **disable** | Entity was disabled |
| **dryrun** | Plan operation was performed |

---

## 🔗 Correlation with Execution Logs

Audit logs are automatically correlated with execution logs through a `trace_id`:

1. When an action creates an audit log, the audit log ID is stored as `trace_id`
2. Any execution logs generated during that action reference the same `trace_id`
3. This allows you to see both **what was done** (audit) and **how it was done** (execution logs)

Example flow:

```
User executes resource
  └─> Audit log created (action: "execute", trace_id: abc-123)
       └─> Execution begins
            └─> Logs written with trace_id: abc-123
```

This enables complete traceability from user action to system execution.
