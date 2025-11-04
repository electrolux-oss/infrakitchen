# Templates

In InfraKitchen, **Templates** define the organizational structure and meta-information for your infrastructure components. They establish hierarchical relationships between different infrastructure elements and provide the framework for provisioning actual resources.

Templates are abstract definitions that become concrete when you create **Resources** from them using **Source Code Versions**. Think of templates as recipes in your infrastructure kitchen—they define what can be built, but not the actual infrastructure itself.

---

## 📋 Template Properties

Each template in InfraKitchen contains the following core properties:

| Property                 | Description                             | Notes                                     |
| :----------------------- | :-------------------------------------- | :---------------------------------------- |
| **Name**                 | Human-readable display name             | E.g., "AWS VPC", "EKS Cluster"            |
| **Template Key**         | Unique, immutable identifier            | Lowercase, alphanumeric with underscores  |
| **Description**          | Detailed information about the template | Markdown supported                        |
| **Status**               | Current state of the template           | `enabled` or `disabled`                   |
| **Abstract**             | Whether template can be instantiated    | If true, serves only as a parent          |
| **Parents**              | Templates this template depends on      | Hierarchical relationships                |
| **Children**             | Templates that depend on this template  | Hierarchical relationships                |
| **Cloud Resource Types** | Types of cloud resources managed        | E.g., `aws_vpc`, `azurerm_resource_group` |
| **Labels**               | Tags for organizing and filtering       | E.g., `aws`, `networking`, `production`   |
| **Revision Number**      | Version tracking for template changes   | Auto-incremented on updates               |

---

## 🌳 Template Hierarchies

Templates support **parent-child relationships** that mirror your infrastructure dependencies. This allows you to establish logical groupings and enforce provisioning order.

**Example Hierarchy:**

```
AWS Account (abstract)
  ↓
AWS Regional Environment
  ↓
AWS VPC
  ↓
EKS Cluster
  ↓
Kubernetes Namespace
```

**Hierarchy Rules:**

- A template cannot be both a parent and child of the same template (no circular dependencies)
- Abstract templates can only serve as parents and cannot be instantiated as resources
- Disabled templates cannot be used as parents or children
- Deleting a template with children is not allowed

---

## ➕ Creating Templates

Templates can be created in two primary ways:

### 1. Import from Repository

Import a template directly from a Git repository containing Infrastructure as Code. InfraKitchen will automatically analyze the code and create both the template and its first source code version.

**Steps:**

1. Navigate to **Templates** in the sidebar
2. Click **Import**
3. Select template type (currently OpenTofu/Terraform)
4. Configure Git source (integration, repository, folder, branch)
5. Add metadata (name, description, labels, parents)
6. Click **Import**

!!! info "Import Process"
    Importing may take a few minutes as InfraKitchen clones the repository, analyzes the code, extracts variables and outputs, and creates the template with its source code version.

### 2. Manual Creation

Create a template from scratch by defining all properties manually. This is useful when you want to establish the organizational structure before adding infrastructure code.

**Steps:**

1. Navigate to **Templates** in the sidebar
2. Click **Create**
3. Fill in required fields (name, template key, description)
4. Configure optional properties (parents, children, labels, cloud resource types)
5. Check **Abstract** if the template should not be instantiated directly
6. Click **Save**

---

## 🔧 Managing Templates

### Template Details

Click **View Details** on any template to see comprehensive information organized into sections:

| Section             | Content                                                                    |
| :------------------ | :------------------------------------------------------------------------- |
| **Overview**        | Status, abstract flag, creation info, labels, parent/child relationships   |
| **Resources**       | All resource instances created from this template                          |
| **Input Variables** | Aggregated variables from source code versions with types and descriptions |
| **Output Values**   | Available outputs after resource provisioning                              |
| **Tree View**       | Visual hierarchy showing parents (upward) or children (downward)           |

### Updating Templates

Template metadata can be modified after creation, with some important constraints:

- Updates increment the revision number
- Template key is immutable and cannot be changed
- Parent/child relationship changes affect hierarchy but not existing resources

### Disabling Templates

Disabling prevents new resources from being created but doesn't affect existing ones.

**Effects of disabling:**

- Cannot create new resources from this template
- Cannot be selected as parent or child for other templates
- Can be re-enabled later
- Existing resources remain functional

### Deleting Templates

Templates must be disabled before deletion and cannot be deleted if they have:

- Child templates
- Existing resources
- Associated source code versions

!!! danger "Permanent Deletion"
    Template deletion is permanent and cannot be undone. Handle all dependencies first.

---

## 🔗 Integration with Other Features

### Template Variables and Source Code Versions

Templates don't contain executable code directly. Instead, they're associated with **Source Code Versions** that contain:

- Infrastructure as Code (OpenTofu/Terraform) modules
- Variable definitions
- Output definitions
- Provisioning logic

A single template can have multiple source code versions, allowing you to:

- Support different implementations
- Version infrastructure code independently
- Test new versions before making them default

### Templates and Resources

[Resources](../resources/overview.md) are concrete instances of templates. Each resource:

- References exactly one template
- Uses a source code version associated with that template
- Inherits the template's hierarchical structure
- Can only have parents matching the template's parent templates

---

## 🔐 Template Permissions

Template actions are controlled by user permissions:

| Action             | Permission Required              |
| :----------------- | :------------------------------- |
| **View**           | All authenticated users          |
| **Create**         | Template create permission       |
| **Edit**           | Admin permission on the template |
| **Disable/Enable** | Admin permission on the template |
| **Delete**         | Admin permission on the template |

Permissions are inherited from the organization's role-based access control (RBAC) configuration.
