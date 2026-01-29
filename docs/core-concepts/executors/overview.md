# Executors

In InfraKitchen, **Executors** are specialized components designed to run infrastructure modules that perform specific, non-reusable tasks. Unlike Resources which are instances of reusable Templates, Executors are purpose-built for one-time operations, utility tasks, and custom workflows that don't fit the template model.

Executors are the utility tools in your infrastructure kitchen - they handle specialized tasks like database migrations, data imports, cleanup operations, and custom scripts that you need to run but don't want to turn into reusable templates.

An executor combines:

- **Source code** (what to run)
- **Runtime** (how to execute it - OpenTofu/Terraform)
- **Command Arguments** (specific instructions for execution)
- **Integrations** (credentials for cloud access)
- **Secrets** (sensitive data needed for execution)
- **Storage** (for state management)

Once executed, executors perform their designated task and maintain their state for tracking and audit purposes.

---

## ♻️ Executor Lifecycle

Executors move through these stages: **Create → Provision → Destroy → Delete**.

**States:** `provision` → `provisioned` → `destroy` → `destroyed`

**Statuses:** `ready`, `queued`, `in_progress`, `done`, `error`, `pending`, `unknown`

Unlike resources, executors are typically task-oriented and may be destroyed after completing their purpose.

---

## 📋 Executor Properties

Each executor in InfraKitchen contains the following core properties:

| Property                 | Description                                    | Notes                                    |
| :----------------------- | :--------------------------------------------- | :--------------------------------------- |
| **Name**                 | Unique identifier for the executor             | Must be unique                           |
| **Description**          | Detailed information about the executor's task | Markdown supported                       |
| **Runtime**              | Execution environment                          | Currently supports `opentofu`            |
| **Command Arguments**              | Arguments to main script                           | E.g., `-var-file=environments/dev/eu-west-1.tfvars` |
| **Source Code**          | Git repository containing the module           | Required                                 |
| **Source Code Version**  | Specific tag/release to use                    | Either version or branch required        |
| **Source Code Branch**   | Specific branch to use                         | Either version or branch required        |
| **Source Code Folder**   | Path to module within repository               | Defaults to root                         |
| **State**                | Lifecycle state                                | `provision`, `provisioned`, `destroy`    |
| **Status**               | Current operation status                       | `queued`, `in_progress`, `done`, `error` |
| **Cloud Integrations**   | Cloud provider credentials                     | Optional, as needed for task             |
| **Secrets**              | Sensitive data for execution                   | Database passwords, API keys, etc.       |
| **Storage**              | Backend for Terraform/OpenTofu state           | S3, Azure Blob, GCS, etc.                |
| **Storage Path**         | Path to state file in storage                  | Auto-generated or custom                 |
| **Labels**               | Tags for organizing and filtering              | E.g., `migration`, `cleanup`, `one-time` |
| **Revision Number**      | Version tracking for executor changes          | Auto-incremented on updates              |
| **Creator**              | User who created the executor                  | Used for permissions and audit           |

---

## ➕ Creating Executors

Executors are created to perform specific infrastructure tasks that don't require the reusability of templates.

### Creation Steps

1. Navigate to **Executors** in the sidebar
2. Click **Create**
3. Configure basic properties:
    - Enter unique name
    - Add description explaining the task
    - Select runtime (`opentofu`)
    - Specify command arguments
4. Configure source code:
    - Select source code repository
    - Choose version (tag) or branch
    - Specify folder path within repository
5. Configure execution context:
    - Select cloud integration(s) if needed
    - Select secrets if needed for sensitive data
    - Select storage backend for state management
    - Specify storage path
6. Add labels for organization
7. Click **Save**

!!! tip "When to Use Executors"
    Use executors for:

    - **Database migrations** - One-time schema updates
    - **Data imports/exports** - Bulk data operations
    - **Cleanup tasks** - Resource decommissioning
    - **Custom scripts** - Specialized automation
    - **Utility operations** - Tasks that don't fit templates

    Use Resources/Templates for:

    - Reusable infrastructure patterns
    - Long-lived infrastructure
    - Hierarchical resource management

---

## 🔧 Managing Executors

Executors support various lifecycle actions based on their current state.

| Action        | When Available             | Description                                 |
| :------------ | :------------------------- | :------------------------------------------ |
| **Provision** | State: `provision`         | Execute the infrastructure task             |
| **Dry Run**   | Before provisioning        | Preview changes without applying            |
| **Update**    | State: `provisioned`       | Modify executor configuration               |
| **Destroy**   | State: `provisioned`       | Clean up infrastructure created by executor |
| **Delete**    | State: `destroyed`         | Permanently remove executor                 |

!!! warning "State Management"
    Even for one-time tasks, executors maintain Terraform/OpenTofu state. This ensures proper cleanup and tracking of any infrastructure modifications made during execution.

---

## 🔐 Executor Integrations

Executors can be associated with multiple integrations to access various cloud providers and services.

### Integration Types

- **Cloud Providers**: AWS, Azure, GCP, MongoDB Atlas, Datadog
- **Required for**: Accessing cloud resources during execution
- **Multiple integrations**: Can use several at once if task spans multiple clouds

**Example:**

```yaml
Executor: database-migration-prod
Integrations:
  - AWS Production Account (for RDS access)
  - MongoDB Atlas Production (for data migration)
```

Learn more about [Cloud Integrations](../../integrations/cloud/overview.md).

---

## 🔒 Executor Secrets

Secrets provide secure access to sensitive data needed during execution.

### Secret Usage

- **Database credentials** - Connection strings, passwords
- **API keys** - Third-party service authentication
- **Certificates** - SSL/TLS certificates
- **Tokens** - Access tokens, refresh tokens

**Example:**

```yaml
Executor: data-export-task
Secrets:
  - database-master-password
  - api-service-key
  - s3-upload-credentials
```

Secrets are securely injected into the execution environment as environment variables.

Learn more about [Secrets Management](../../secrets/overview.md).

---

## 💾 Executor Storage

Executors require storage backends to persist Terraform/OpenTofu state.

### Supported Storage Backends

- **AWS S3** - With DynamoDB for state locking
- **Azure Blob Storage** - With blob leases for locking
- **Google Cloud Storage** - With native locking

### Storage Path

Each executor uses a unique storage path to isolate its state from other executors and resources:

```
<storage-bucket>/executors/<executor-name>/terraform.tfstate
```

This ensures executors can be safely executed in parallel without state conflicts.

## 🔗 Executors vs Resources

Understanding when to use each:

| Feature               | Executor                         | Resource                            |
| :-------------------- | :------------------------------- | :---------------------------------- |
| **Purpose**           | One-time/specific tasks          | Long-lived infrastructure           |
| **Reusability**       | Not reusable                     | Based on reusable templates         |
| **Hierarchy**         | No parent-child relationships    | Follows template hierarchy          |
| **Template Required** | No                               | Yes                                 |
| **Variables**         | Defined in source code           | Defined in template + source code   |
| **Common Uses**       | Migrations, imports, cleanup     | VPCs, clusters, databases           |
| **Lifecycle**         | Often short-lived                | Typically long-lived                |

**Decision Guide:**

- ✅ Use **Executor**: "I need to run a database migration once in production"
- ✅ Use **Resource**: "I need to provision a VPC that follows our standard template"

---

## 📊 Executor Outputs

After successful execution, executors may produce outputs that can be:

- Viewed in the UI in logs tab
- Used for verification and audit

---

## 🔐 Executor Permissions

Executor actions are controlled by role-based access control:

| Action               | Permission Required          |
| :------------------- | :--------------------------- |
| **View**             | Read access                  |
| **Create**           | Read access   |
| **Edit**             | Admin access                 |
| **Execute**          | Write access                 |
| **Destroy**          | Admin access                 |
| **Delete**           | Admin access                 |

---

## 🔗 Integration with Other Features

### Executors and Source Code

Executors reference Git repositories containing infrastructure code:

- Must specify either a version (tag) or branch
- Can use any folder within the repository
- Support mono-repos with multiple modules
- Track source code changes via revision numbers

### Executors and Storage

State management is critical for executors:

- Enables proper cleanup even for one-time tasks
- Tracks what infrastructure was modified
- Prevents conflicts with parallel executions
- Supports state rollback if needed

### Executors and Workspaces

Unlike resources, executors typically don't use workspace Git sync:

- Executor code comes directly from source code repository
- No automatic Git commits of generated Terraform
- State is stored in configured backend only

---

## 🚀 Best Practices

### Naming Conventions

Use descriptive names that indicate purpose and context:

```
✅ Good:
- prod-db-migration-v2-0-0
- staging-cleanup-unused-volumes
- monthly-cost-report-export

❌ Avoid:
- executor-1
- test-task
- my-script
```

### Version Management

- Use **tags** for stable, tested code
- Use **branches** only for development/testing
- Tag executor code releases just like application releases
- Document what each version does in Git commit messages

### Security

- Use secrets for ALL sensitive data
- Never hardcode credentials in executor source code
- Limit integrations to minimum required
- Audit executor executions regularly
- Use approval workflows for production tasks

### Lifecycle Management

- Destroy executors after task completion (if one-time)
- Keep executors for recurring tasks
- Use labels to track executor status
- Document executor purpose in description

### Error Handling

- Always include error handling in executor code
- Use Terraform/OpenTofu best practices for retries
- Set appropriate timeouts for long-running tasks
- Monitor executor execution logs
- Have rollback procedures documented

---

## 📚 Related Documentation

- [Core Concepts Overview](../overview.md)
- [Resources Documentation](../resources/overview.md)
- [Integrations](../../integrations/overview.md)
- [Secrets Management](../../secrets/overview.md)
