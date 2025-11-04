# Resources

In InfraKitchen, **Resources** are concrete instances of infrastructure created from **Templates** using specific **Source Code Versions**. While templates define what _can_ be built, resources represent _actual infrastructure_ running in your cloud environments.

Resources are the operational units in your infrastructure kitchen—they're the actual dishes prepared from your recipes (templates), actively managed through their entire lifecycle from creation to destruction.

A resource combines:

- A **template** (what to build)
- A **source code version** (how to build it)
- **Variables** (configuration values)
- **Cloud integrations** (credentials)
- **Storage** (for Terraform/OpenTofu state)
- **Parent resources** (dependencies)

Once provisioned, resources run real infrastructure in your cloud accounts.

---

## ♻️ Resource Lifecycle

Resources move through these stages: **Create → Provision → Update → Destroy → Delete**.

**States:** `provision` → `provisioned` → `destroy` → `destroyed`

**Statuses:** `ready`, `queued`, `in_progress`, `done`, `error`, `approval_pending`, `pending`, `rejected`, `enabled`, `disabled`, `unknown`

For detailed workflows and state transitions, see [Resource Workflows](workflow.md).

---

## 📋 Resource Properties

Each resource in InfraKitchen contains the following core properties:

| Property                | Description                                 | Notes                                               |
| :---------------------- | :------------------------------------------ | :-------------------------------------------------- |
| **Name**                | Unique identifier for the resource          | Must be unique per template and source code version |
| **Description**         | Detailed information about the resource     | Markdown supported                                  |
| **Template**            | The template this resource is based on      | Immutable after creation                            |
| **Source Code Version** | The version of IaC code to use              | Can be updated to new versions                      |
| **State**               | Lifecycle state                             | `provision`, `provisioned`, `destroy`, `destroyed`  |
| **Status**              | Current operation status                    | `queued`, `in_progress`, `done`, `error`, etc.      |
| **Cloud Integrations**  | Cloud provider credentials                  | Required for provisioning                           |
| **Storage**             | Backend for Terraform/OpenTofu state        | S3, Azure Blob, GCS, etc.                           |
| **Storage Path**        | Path to state file in storage               | Immutable after creation                            |
| **Workspace**           | Terraform/OpenTofu workspace                | Optional, for workspace isolation                   |
| **Variables**           | Input variables for the infrastructure code | Values for Terraform/OpenTofu variables             |
| **Outputs**             | Exported values after provisioning          | Available after successful provision                |
| **Dependency Tags**     | Tags inherited by cloud resources           | Automatically applied to provisioned infrastructure |
| **Dependency Config**   | Configuration shared with child resources   | For passing values down the hierarchy               |
| **Parents**             | Resources this depends on                   | Must match template's parent templates              |
| **Children**            | Resources that depend on this               | Automatically populated                             |
| **Labels**              | Tags for organizing and filtering           | E.g., `production`, `us-east-1`, `team-platform`    |
| **Abstract**            | Whether resource is abstract                | Abstract resources only define hierarchy            |
| **Revision Number**     | Version tracking for resource changes       | Auto-incremented on updates                         |
| **Creator**             | User who created the resource               | Used for permissions and audit                      |

---

## ➕ Creating Resources

Resources can be created in two ways:

### 1. From Template (Standard Creation)

The standard way to create a resource from an existing template:

**Steps:**

1. Navigate to **Resources** in the sidebar
2. Click **Create**
3. Select a template
4. Configure resource properties:
      - Enter unique name
      - Add description (optional)
      - Select parent resources (if template has parents)
5. Configure dependency tags and configs (optional)
6. Configure template properties:
      - Add labels
      - Select cloud integration(s)
      - Select workspace (optional)
7. Select source code version
8. Configure input variables based on the selected version
9. Click **Save**

!!! info "Parent Resources"
    If your template has parent templates defined, you must select parent resources that match those parent templates. This enforces the hierarchical structure defined in your templates.

### 2. Abstract Resources

Abstract resources don't provision actual infrastructure—they only define organizational hierarchy and share configuration with child resources:

**Steps:**

1. Follow standard creation steps 1-5, configure:
      - Name, description, labels
      - Parent resources (if applicable)
      - Dependency tags (to be inherited by children)
      - Dependency configs (to populate variables in children)
2. Skip infrastructure settings (not required for abstract resources)
3. Click **Save**

!!! tip "Abstract Resources"
    Abstract resources are ideal for:

    - Creating logical groupings (e.g., "Production Environment")
    - Establishing hierarchy without infrastructure
    - Organizing resources by teams, projects, or environments
    - Defining shared tags and configuration for child resources

---

## 🔧 Managing Resources

Resources support various lifecycle actions based on their current state.

| Action        | When Available             | Description                                     |
| :------------ | :------------------------- | :---------------------------------------------- |
| **Provision** | State: `provision`         | Execute infrastructure code to create resources |
| **Dry Run**   | Before provisioning        | Preview changes without applying                |
| **Update**    | State: `provisioned`       | Modify existing infrastructure                  |
| **Recreate**  | State: `provisioned`       | Destroy and re-provision the resource           |
| **Destroy**   | State: `provisioned`       | Remove infrastructure from cloud                |
| **Delete**    | State: `destroyed`         | Permanently remove resource from InfraKitchen   |
| **Approve**   | Status: `approval_pending` | Approve pending operation (if approval enabled) |
| **Reject**    | Status: `approval_pending` | Reject pending operation                        |

!!! tip "Workflow Details"
    For step-by-step processes, state transitions, and approval flows, see the [detailed workflow documentation](workflow.md).

---

## 📊 Resource Variables

Variables are how you configure your infrastructure code.

### Variable Properties

- **Required**: Must be provided before provisioning
- **Frozen**: Cannot be changed after initial provision
- **Unique**: Must be unique across resources with same template
- **Sensitive**: Masked in UI and logs
- **Options**: Limited to predefined choices
- **Reference**: Can reference outputs from parent resources

### Variable References

Variables can reference outputs from parent resources:

```yaml
# Example: Reference VPC ID from parent resource
variable:
  name: vpc_id
  type: string
  reference:
    resource: parent-vpc-resource-id
    output: vpc_id
```

This creates automatic dependency chains and ensures child resources have access to parent outputs.

---

## 📤 Resource Outputs

After successful provisioning, resources export output values that can be:

- Referenced by child resources as variable inputs
- Used in dependency configurations
- Displayed in the UI
- Retrieved via API

Outputs are automatically extracted from Terraform/OpenTofu state files after provisioning completes.

---

## 🔗 Dependency Management

InfraKitchen provides two mechanisms for sharing data between parent and child resources in a hierarchy. These can be configured on **both abstract and provisioned resources**.

### Dependency Tags

Key-value pairs that can be:

- Automatically applied to all cloud resources created during provisioning
- Inherited by child resources (when `inherited_by_children` is enabled)

**Example:**

```json
{
  "name": "Environment",
  "value": "Production",
  "inherited_by_children": true
}
```

**Common uses:**

- Cost allocation and billing tags
- Compliance and security tags
- Team/ownership identification
- Environment classification

**How inheritance works:**

1. Set tags on a parent resource (abstract or provisioned)
2. Enable `inherited_by_children` flag
3. All child resources automatically receive these tags
4. Tags are applied to actual cloud resources during provisioning

### Dependency Configs

Configuration key-value pairs that are automatically populated as variable values when creating child resources.

**Example:**

```json
{
  "name": "vpc_cidr",
  "value": "10.0.0.0/16",
  "inherited_by_children": true
}
```

**Common uses:**

- Network configuration (CIDR blocks, subnets)
- Naming conventions and prefixes
- Shared application settings
- Regional or environment-specific values

**How inheritance works:**

1. Set configs on a parent resource (abstract or provisioned)
2. Enable `inherited_by_children` flag
3. When creating a child resource, if a variable name matches a config name, the config value is automatically used as the variable's default value
4. Child resources can override inherited values if needed

!!! tip "Abstract Resources for Configuration"
    Abstract resources are ideal for defining dependency tags and configs at high levels in your hierarchy (e.g., Account, Environment) that cascade down to all child resources.

**Example Hierarchy:**

```
AWS Account (abstract)
├─ Dependency Tags:
│  └─ {name: "BillingCode", value: "PROD-001", inherited_by_children: true}
├─ Dependency Configs:
│  └─ {name: "aws_region", value: "us-east-1", inherited_by_children: true}
│
└─ AWS VPC (provisioned)
   └─ Inherits: BillingCode tag + aws_region config
```

This ensures all resources under the AWS Account automatically receive consistent tags and configuration values.

---

## 🌳 Resource Hierarchies

Resources inherit the hierarchical structure from their templates:

**Example Hierarchy:**

```
AWS Account (abstract)
  ↓
AWS Regional Environment (abstract)
  ↓
AWS VPC (provisioned)
  ↓
EKS Cluster (provisioned)
  ↓
Kubernetes Namespace (provisioned)
```

**Hierarchy Rules:**

- Parent resources must match template's parent templates
- Parent resources can be in `provisioned` state (for provisioned resources) or any valid state (for abstract resources)
- Destroying provisioned parent resources requires destroying children first
- Dependency tags and configs flow down the hierarchy from both abstract and provisioned parents
- Abstract resources skip the provision/destroy steps but can still have children

---

## 🔐 Resource Permissions

Resource actions are controlled by role-based access control:

| Action               | Permission Required        |
| :------------------- | :------------------------- |
| **View**             | Read access                |
| **Create**           | Resource create permission |
| **Edit**             | Write access               |
| **Provision/Update** | Write access               |
| **Destroy**          | Admin access               |
| **Delete**           | Admin access               |
| **Approve**          | Owner (if approval flow)   |

Permissions can be configured at:

- Organization level
- Environment level
- Resource level (via inheritance)

---

## 🔗 Integration with Other Features

### Resources and Templates

Resources are instances of templates. Each resource:

- References exactly one template
- Uses a source code version associated with that template
- Inherits the template's hierarchical structure
- Can be provisioned with different variable values

Learn more about [Templates](../templates/overview.md).

### Resources and Source Code Versions

Source code versions contain the actual infrastructure code. Resources:

- Must select a source code version to provision
- Can be updated to newer versions
- Extract variables from the selected version
- Use the version's Terraform/OpenTofu modules

### Resources and Integrations

Cloud integrations provide credentials for provisioning:

- Multiple integrations can be associated with one resource
- Required for accessing cloud providers
- Used for both provisioning and metadata retrieval
- Support various authentication methods (IAM roles, service principals, etc.)

Learn more about [Cloud Integrations](../../integrations/cloud/overview.md).

### Resources and Storage

Storage backends persist Terraform/OpenTofu state:

- S3 for AWS
- Azure Blob Storage for Azure
- Google Cloud Storage for GCP
- State locking supported
- Encryption at rest

### Resources and Workspaces

Terraform/OpenTofu workspaces provide isolation:

- Optional feature
- Useful for multi-tenancy
- Separate state files per workspace
- Can be changed after creation

---

## 🚀 Advanced Features

### Temporary State Management

When updating resources, InfraKitchen creates a temporary state that allows you to:

- Preview changes before applying them to production
- Compare current vs. proposed configuration
- Make adjustments before committing
- Merge approved changes or discard unwanted modifications
- Automatic cleanup after merge or discard

See [Update Step - Temporary State Workflow](workflow.md#temporary-state-workflow) for the complete process.

### Kubernetes Integration

For resources that provision Kubernetes clusters:

- View pod status and details
- Monitor deployments and services
- Access real-time container logs
- Execute commands in pods (if configured)

Learn more about [Kubernetes Integration](../../operations/kubernetes.md).

### Audit Logging

All resource operations are logged:

- Who performed action
- What changed
- When it occurred
- Operation outcome

Learn more about [Audit Logging](../../operations/activity/audit.md).
