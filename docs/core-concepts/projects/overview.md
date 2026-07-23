# Projects

In InfraKitchen, **Projects** group related resources under a shared operational boundary. A project gives teams one place to manage ownership, access policies, inherited defaults, and an optional shared workspace for a set of infrastructure resources.

Projects do not provision infrastructure themselves. Instead, they help standardize how multiple [Resources](../resources/overview.md) are created and managed.

---

## 📋 Project Properties

Each project in InfraKitchen contains the following core properties:

| Property | Description | Notes |
| :------- | :---------- | :---- |
| **Name** | Human-readable project name | Must be unique |
| **Description** | Summary of the project's purpose | Optional |
| **Workspace** | Shared workspace reference | Optional |
| **Configuration** | Project-level behavior flags | Currently includes `always_use_workspace` |
| **Owners** | Users allowed to administer the project | Owners effectively gain project admin actions |
| **Dependency Tags** | Default tags shared with project resources | Can be inherited by children |
| **Dependency Config** | Default config values shared with project resources | Can be inherited by children |
| **Labels** | Tags for filtering and organization | Free-form list |
| **Status** | Current project status | `enabled` or `disabled` |
| **Revision Number** | Version tracking for changes | Auto-incremented on updates |
| **Creator** | User who created the project | Used for audit and permissions |

---

## 🧱 What Projects Are For

Use projects when you want multiple resources to share the same governance and defaults.

Projects are useful for:

- Grouping resources by team, product, environment, or business domain
- Assigning a clear set of project owners
- Applying shared labels, tags, and inherited configuration defaults
- Reusing a single workspace across project resources when appropriate
- Managing project-level policies separately from individual resources

Example:

```yaml
Project: payments-platform
Owners:
  - platform-admin@example.com
  - sre@example.com

Workspace: platform-live-infra
Configuration:
  always_use_workspace: true

Dependency Tags:
  - name: team
    value: platform
    inherited_by_children: true
  - name: cost_center
    value: fin-042
    inherited_by_children: true

Dependency Config:
  - name: environment
    value: production
    inherited_by_children: true
```

Resources assigned to this project can inherit those values automatically, while still keeping their own template, variables, parents, and lifecycle state.

---

## ➕ Creating Projects

Projects are created from the **Projects** section in the UI.

**Steps:**

1. Navigate to **Projects** in the sidebar
2. Click **Create**
3. Enter the project name and optional description
4. Select an optional workspace
5. Configure optional labels and owners
6. Set project configuration such as **Always use workspace**
7. Add optional dependency tags and dependency config values
8. Click **Save**

---

## ⚙️ Project Configuration

Projects currently support one project-level configuration flag:

| Option | Description | Notes |
| :----- | :---------- | :---- |
| **Always Use Workspace** | Forces project resources to use the project's assigned workspace for workspace sync operations | Requires the project to have a workspace assigned |

When `always_use_workspace` is enabled:

- A resource in the project can use the project's workspace automatically
- The project workspace acts as the fallback sync target during resource workspace operations
- This helps keep related resource code in one repository boundary

---

## 🔗 Project Defaults and Inheritance

Projects can define shared dependency tags and dependency config values.

### Dependency Tags

Project dependency tags are useful for applying shared metadata such as billing, ownership, or environment classification across the resources in that project.

### Dependency Config

Project dependency config values act as low-priority defaults for resource variables. When InfraKitchen prepares a resource, project config is applied first, and then parent resource config can override it.

This makes projects a good place for broad defaults such as:

- environment names
- naming prefixes
- common region or platform settings
- standard cloud tagging inputs

!!! info "Priority Order"
    Project dependency config acts as defaults. Parent resource configuration is applied after that and can override project-provided values.

---

## 🔧 Managing Projects

Projects support the following lifecycle actions:

| Action | When Available | Description |
| :----- | :------------- | :---------- |
| **Edit** | Status: `enabled` | Update project metadata, owners, labels, workspace, or defaults |
| **Disable** | Status: `enabled` | Prevent further project administration actions until re-enabled |
| **Enable** | Status: `disabled` | Re-activate the project |
| **Delete** | Status: `disabled` | Permanently remove the project |

---

## 🔐 Permissions

Project actions are controlled by RBAC and project ownership.

| Action | Permission Model | Notes |
| :----- | :--------------- | :---- |
| **View** | Standard authenticated access and entity visibility rules | Depends on platform RBAC |
| **Create** | Project API write permission | Required to create new projects |
| **Edit / Disable / Enable / Delete** | Project admin, project owner, or super admin | Owners effectively gain admin actions |
| **Manage Policies** | Project admin-level access | Controls entity-level rules |

Owners are not just informational. InfraKitchen checks the owner list when deciding whether a user can administer project actions.

---

## 🔗 Integration with Other Features

Projects connect several InfraKitchen concepts:

- **Resources** can belong to a project and inherit project tags/config defaults
- **Workspaces** can be assigned at the project level to centralize generated code sync
- **Policies** can be applied at the project boundary, separate from individual resources
- **Audit Logs** and **Revisions** track changes to project metadata over time
