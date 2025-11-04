# Execution Logs

Execution logs capture the detailed output (stdout/stderr) from operations performed on entities. These logs provide real-time visibility into what happens during provisioning, synchronization, and other operations.

## 📝 Overview

When you execute operations like provisioning a resource or syncing source code, InfraKitchen captures all output in execution logs. Each execution is timestamped and correlated with an audit log entry through a `trace_id`.

---

## 👁️ Viewing Execution Logs

Access execution logs for an entity:

1. Navigate to the entity
2. Click the **Activity** button
3. Select the **Logs** tab
4. Choose an execution from the dropdown to view its logs

The logs interface shows:

- **Execution dropdown** — Select from recent executions (displays timestamp and action)
- **Revision button** — View the entity configuration at the time of execution
- **Log viewer** — Real-time scrollable log output with ANSI color support

---

## 📋 Log Structure

Each log entry contains:

| Field | Description |
|-------|-------------|
| **Entity ID** | The entity that generated the log |
| **Entity Type** | The type of entity (resource, source_code, etc.) |
| **Revision** | The configuration revision used during execution |
| **Level** | Log severity (info, warning, error, header) |
| **Data** | The actual log message or output |
| **Created At** | When the log entry was created |
| **Execution Start** | Timestamp identifying the execution session |
| **Trace ID** | Links the log to its originating audit log entry |

---

## 🕐 Log Retention

Logs have different retention policies:

- **Standard logs** — Retained indefinitely for historical reference
- **Dry run logs** — Automatically expire after 5 days to save storage

!!! tip "Viewing Historical Executions"
    Use the execution dropdown to navigate through previous operations. Each execution shows the timestamp and action (e.g., "sync", "execute") to help identify the operation you're looking for.
