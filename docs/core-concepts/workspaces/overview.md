# Workspaces

In InfraKitchen, **Workspaces** connect your managed infrastructure resources to a real Git repository that stores the generated Infrastructure-as-Code for each resource. While *Templates* define the abstract structure and *Resources* represent concrete instances, **Workspaces** are the Git-backed execution surface where resource code is synchronized, reviewed, and promoted through pull requests.

A workspace represents a single repository on a supported Git provider ([GitHub](../../integrations/git/github.md), [Bitbucket](../../integrations/git/bitbucket.md), [Azure DevOps](../../integrations/git/azure-devops.md)). The repository itself must be created manually beforehand in the provider and then registered inside InfraKitchen. InfraKitchen never creates repositories; it consumes them.

---

## 🧱 Core Concepts

Think of a **Workspace** as the stable home and audit boundary for all code generated from Resources belonging to a given integration scope. When a Resource is provisioned or updated, InfraKitchen syncs (or deletes) the corresponding code folder into the workspace repository under a deterministic path based on the template and resource name.

Workspace automation handles:

- Cloning and branching
- Copying generated resource source code (e.g. OpenTofu/Terraform modules and support files)
- Creating pull requests for new or updated resources
- Merging (approve) or closing (reject) those pull requests
- Deleting resource code when the resource is destroyed

Every change is evented and audit-logged.

---

## 📋 Workspace Properties

| Property | Description | Notes |
| :------- | :---------- | :---- |
| **Name** | Derived from provider metadata (GitHub repo name, Bitbucket slug, Azure DevOps repo name) | Immutable after creation |
| **Workspace Provider** | Git service backing the workspace | `github`, `bitbucket`, `azure_devops` |
| **Integration** | The configured integration object used for auth & API access | Must match provider |
| **Description** | Human-readable notes about the workspace | Editable |
| **Labels** | Tags for organization & filtering | Free-form list |
| **Status** | Internal processing state | `in_progress`, `done`, `error` |
| **Configuration.name** | Repository name | Mirrors provider value |
| **Configuration.url** | Canonical HTML/portal URL | Provider dependent |
| **Configuration.ssh_url** | SSH clone URL | Used if integration uses SSH |
| **Configuration.https_url** | HTTPS clone URL (username stripped) | Used if integration uses HTTPS |
| **Configuration.default_branch** | Branch used as merge base | Usually `main` (GitHub/Azure) or provider default |
| **Configuration.organization** | Owning organization / project key | Provider-specific mapping |
| **Created At / Updated At** | Timestamps | Auto-managed |
| **Creator** | User who registered workspace | For audit & permissions |

---

## 📁 Folder Layout for Synced Code

When a resource is synchronized into a workspace repository its code is placed at:

```
<repo_root>/<template_key>/<resource_name_slug>/
```

Where:

- `template_key` is the template's unique key
- `resource_name_slug` is the lowercased resource name with spaces replaced by underscores

Example:

```
aws_vpc/prod_network_vpc/
kubernetes_namespace/analytics_namespace/
```

---

## ♻️ Lifecycle & Actions

| Action | Trigger | Effect | Git Operation |
| :----- | :------ | :----- | :------------ |
| **Create** | Workspace registration | Stores metadata only | None |
| **Sync (Provision / Update)** | Resource provision/update | Copies resource code into repo path on a new branch | Clone, new branch, copy, commit, push, PR create |
| **Delete (Destroy)** | Resource destroy | Removes resource code folder via new branch | Clone, new branch, delete folder, commit, push, PR create |
| **Approve** | Manual approval of resource changes | Merges the pending PR into default branch | API merge PR |
| **Reject** | Manual rejection | Closes the pending PR without merge | API close PR |
| **Recreate** | Forced re-sync (internal) | Sync + approve flow | Combined |
| **Destroy Workspace** | Admin deletion (only if no dependencies) | Removes workspace record | None |

Workspace status transitions revolve around task execution:

- Set to `in_progress` at start of a sync/approve/reject/destroy pipeline
- Set to `done` on completion
- Set to `error` on failure or retry exhaustion

---

## 🌿 Branch Naming Convention

Branches created for resource operations follow:

| Resource State | Branch Prefix | Example |
| :------------- | :------------ | :------ |
| Provision / Provisioned | `update_` | `update_prod_network_vpc` |
| Destroy / Destroyed | `delete_` | `delete_prod_network_vpc` |

The suffix derives from the slugified resource name.

---

## 🔀 Pull Request Flow

1. Clone repository using SSH or HTTPS depending on integration type
2. Create new branch from default branch
3. Copy or delete resource code path
4. Commit changes with a structured message including the initiating user
5. Push branch (force if necessary to ensure latest state)
6. Attempt PR creation (skips if already exists)
7. Await manual action:
     - Approve: Merge PR into default branch
     - Reject: Close PR without merge

!!! info "Idempotency"
    If a pull request with the same head branch already exists, InfraKitchen logs and skips PR creation to avoid duplicates.

---

## ➕ Creating a Workspace

You must first create a repository in your Git provider (GitHub, Bitbucket, Azure DevOps). Then register that repository in InfraKitchen.

**Steps:**

1. Navigate to **Workspaces** in the sidebar
2. Click **Create**
3. Select provider and integration
4. Paste or select repository metadata (InfraKitchen fetches details via provider API)
5. Add optional description & labels
6. Click **Save**

InfraKitchen normalizes provider-specific metadata into a unified configuration.

!!! info "Repository Ownership"
    InfraKitchen does not modify repository settings, permissions, or branches beyond creating feature branches and PRs for resource code.

---

## ✏️ Updating a Workspace

Only description and labels can be modified. Name, provider, integration, and configuration internals are immutable. Updates emit an audit log and event.

---

## 🗑️ Deleting a Workspace

A workspace can be deleted only if it has no dependent resources.

**Constraints:**

- No resources referencing the workspace
- No implicit locks or pending tasks

Attempting deletion with dependencies raises an error.

!!! danger "Irreversible"
    Deleting a workspace removes its InfraKitchen record. It does not delete the underlying Git repository.

---

## 🔐 Permissions

| Action | Permission | Notes |
| :----- | :--------- | :---- |
| **View** | Authenticated users | Basic list & detail |
| **Create** | Workspace create permission | Integration must be accessible |
| **Update** | Write/admin on workspace | Limited fields |
| **Approve / Reject** | Write/admin on resource & workspace | Acts on existing PR |
| **Delete Workspace** | Admin on workspace | Requires no dependencies |

Permissions leverage the platform RBAC and entity-level access checks.

---

## 🔗 Integration with Templates & Resources

- **Templates** define structural hierarchy and naming; workspace code layout nests resource folders under their template key.
- **Resources** trigger workspace sync tasks on create/update/destroy.
- The workspace never stores execution state; it stores generated IaC code for review and promotion.
- Pull requests provide a human approval gate before code lands in the default branch, enabling policy checks or external CI.

Cross-links:

- [Templates](../templates/overview.md)
- [Resources](../resources/overview.md)

---

## 🔧 Troubleshooting

| Symptom | Possible Cause | Resolution |
| :------ | :------------- | :-------- |
| PR not created | Existing branch/PR already open | Approve or close existing PR; trigger resync |
| Workspace status stuck `in_progress` | Task failure before final state | Check entity logs; look for Git auth errors |
| Missing resource folder | Sync not triggered or branch not merged | Verify resource state and PR approval |
| Merge fails | API permissions insufficient | Ensure integration token has repo write & PR merge rights |
