# Core Concepts

InfraKitchen introduces several key concepts that work together to enable self-service infrastructure provisioning. This page explains each concept and how they relate to each other.

---

## 🔌 Integration

An **Integration** stores the credentials and configuration needed to connect to external systems.

### Types of Integrations

- **Cloud Providers:** AWS, Azure, Google Cloud, MongoDB Atlas, Datadog

- **Git Providers:** GitHub, Bitbucket, Azure DevOps

- **Auth Providers:** GitHub OAuth, Microsoft OAuth, Backstage integration, Service Accounts

**Learn more:** [Integrations Documentation](../integrations/overview.md)

---

## 📝 Template

A **Template** defines a logical unit of infrastructure. Templates are organized hierarchically and represent components like AWS Accounts, VPCs, EKS Clusters, or RDS databases.

### Template Hierarchy Example

```
AWS Account (abstract)
├── AWS Region (abstract)
│   ├── VPC (concrete)
│   │   ├── EKS Cluster (concrete)
│   │   ├── RDS Database (concrete)
│   │   └── Application Load Balancer (concrete)
│   └── S3 Bucket (concrete)
```

**Learn more:** [Templates Documentation](templates/overview.md)

---

## 📦 Source Code

InfraKitchen embraces Infrastructure-as-Code (IaC). **Source Code** refers to a Git repository containing Terraform/OpenTofu modules.

### Source Code Components

1. **Repository URL** - Where the IaC code is stored
2. **Git Provider Integration** - Credentials to access the repository
3. **Multiple Modules** - One repository can contain multiple infrastructure modules

**Example:**

```
Repository: github.com/myorg/terraform-modules
├── aws-vpc/
├── aws-eks/
└── aws-rds/
```

---

## ⚙️ Executor

An **Executor** is a specialized component for running infrastructure modules that perform specific, non-reusable tasks.

### Use Cases

Unlike Templates that define reusable infrastructure patterns, Executors are designed for:

- **One-time operations** - Database migrations, data imports, cleanup tasks
- **Specialized workflows** - Custom scripts that don't fit the template model
- **Utility tasks** - Infrastructure operations that aren't meant to be templated

### Executor Properties

```yaml
ID: exec-xyz789
Name: database-migration-v2
Runtime: opentofu
Command: -var-file=environments/dev/eu-west-1.tfvars
Source Code: github.com/myorg/utility-scripts
Version: v2.1.0
Module Path: migrations/database-v2/

Integrations:
  - AWS Production Account
  - Database Credentials

State: provisioned
Status: done
```

### Key Differences from Resources

- **Not templated** - Executors run specific modules directly
- **Task-oriented** - Designed for single-purpose operations
- **No hierarchy** - Executors don't follow parent-child relationships

**Learn more:** [Executors Documentation](executors/overview.md)

---

## � Blueprint

A **Blueprint** is a reusable definition that combines multiple Templates into a single, executable plan. Blueprints define which infrastructure components to provision and how their outputs wire together — turning a multi-resource stack into a one-click operation.

### What a Blueprint Contains

- **Templates** — ordered list of infrastructure components to provision
- **Wiring Rules** — output → input mappings between templates
- **Default Variables** — pre-configured values per template
- **Configuration** — general blueprint settings
- **Labels** — tags for organizing and filtering

### How Blueprints Work

1. Select templates that make up your infrastructure stack
2. Define wiring rules to connect outputs to inputs across templates
3. Set default variables for consistent values across executions
4. Execute the blueprint — a Workflow is created with steps in topological order
5. Each step provisions a resource, passing outputs from completed steps to downstream steps

### Key Features

- **Multi-resource orchestration** — provision entire environments in one click
- **Automatic dependency resolution** — wiring rules define the execution graph
- **Reusable definitions** — execute the same blueprint for dev, staging, and production
- **Variable overrides** — customize each execution without modifying the blueprint

**Learn more:** [Blueprints Documentation](blueprints/overview.md)

---

## �🔄 Workflow

A **Workflow** is an automated execution plan that orchestrates the provisioning of multiple resources in dependency order. Workflows are created from Blueprints.

### How Workflows Work

1. A Blueprint defines templates and wiring rules (output → input mappings)
2. When executed, a Workflow is created with steps sorted in topological order
3. Each step provisions a resource, passing outputs from completed steps to downstream steps

### Workflow Example

```yaml
Blueprint: Production Environment
Wiring:
  - VPC.vpc_id → EKS Cluster.vpc_id
  - VPC.private_subnet_ids → EKS Cluster.subnet_ids
  - VPC.vpc_id → RDS Database.vpc_id

Execution Order:
  Level 0: VPC (no dependencies)
  Level 1: EKS Cluster, RDS Database (parallel, both depend on VPC)
```

### Key Features

- **Automatic dependency resolution** via topological sort
- **Output wiring** — upstream outputs feed into downstream inputs
- **Parallel execution** — independent steps run simultaneously
- **Step-level tracking** — monitor progress per resource

**Learn more:** [Workflows Documentation](workflows/overview.md)

---

## 📦 Resource

A **Resource** is an actual instance of infrastructure, created from a Template and Source Code Version.

### Resource Properties

```yaml
ID: res-abc123
Name: production-vpc-us-east-1
Template: Production VPC
Parent Resource: aws-account-prod
Source Code Version: v1.2.0
State: provisioned
Status: done

Variables:
  vpc_name: 'production-vpc'
  cidr_block: '10.0.0.0/16'

Outputs:
  vpc_id: 'vpc-0123456789'
  availability_zones: ['us-east-1a', 'us-east-1b']
```

**Learn more:** [Resources Documentation](resources/overview.md)

---

## 💼 Workspace

A **Workspace** is a Git repository where InfraKitchen can automatically sync generated Terraform code.

### Structure

```
workspace-repo/
├── production-vpc/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── production-eks/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
```

**Learn more:** [Workspaces Documentation](workspaces/overview.md)
