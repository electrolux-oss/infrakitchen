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

## 🏷️ Source Code Version

A **Source Code Version** links a specific Template to a specific version of IaC code in a repository.

### Components

```yaml
Template: Production VPC
Source Code: github.com/myorg/terraform-modules
Tag/Branch: v1.2.0
Module Path: aws-vpc/
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
