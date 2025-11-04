# Revisions

Revisions track the configuration history of entities over time. Every time you modify an entity, InfraKitchen creates a new revision, allowing you to view changes and compare configurations.

## 📝 Overview

A revision is a snapshot of an entity's configuration at a specific point in time. Revisions are automatically created whenever you update an entity, providing complete change history without manual intervention.

!!! info "Automatic Creation"
    Revisions are created automatically on every entity update. If no changes are detected (identical configuration), no new revision is created to avoid clutter.

---

## 👁️ Viewing Revisions

Access revisions for an entity:

1. Navigate to the entity
2. Click the **Activity** button
3. Select the **Revisions** tab
4. View the revision history and compare versions

---

## 📊 Revision Interface

The revisions interface has three main sections:

### 1. Revision List

Displays all revisions for the entity:

| Info | Description |
|------|-------------|
| **Version** | Revision number (e.g., v1, v2, v3) |
| **Timestamp** | When the revision was created |
| **Name** | Optional human-readable name (from entity name field) |
| **Description** | Optional description (from entity description field) |

Revisions are listed in descending order (newest first).

### 2. Compare Section

Select two revisions to compare:

- **Left revision dropdown** — Choose the older/base version
- **Right revision dropdown** — Choose the newer/modified version
- Defaults to comparing the two most recent revisions

### 3. Diff Viewer

Diff viewer showing:

- **Highlighted changes** — Additions, deletions, and modifications
- **Line numbers** — For precise change identification
- **JSON formatting** — Pretty-printed for readability

---

## 🔍 Comparing Revisions

The diff viewer highlights changes between revisions:

- **Green** — Added fields or modified values (new state)
- **Red** — Removed fields or previous values (old state)
- **White** — Unchanged fields

!!! tip "Understanding Changes"
    The diff viewer shows the complete JSON structure. Look for highlighted lines to quickly identify what changed between revisions. Nested objects are expanded for full visibility.
