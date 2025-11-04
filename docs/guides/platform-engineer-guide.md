# Platform Engineer Guide

This guide is for platform engineers responsible for enabling self-service infrastructure in **InfraKitchen**.
It covers the key concepts, patterns, and best practices needed to deliver secure, consistent, and auditable infrastructure workflows at scale.

## ✅ Quick Checklist

1. Create cloud integrations (AWS/Azure/GCP + any ancillary: Datadog, MongoDB).
2. Create Git provider integration(s).
3. Register workspaces (Git repos for generated resource code).
4. Define hierarchy (Account → Environment/Region → Network → Platform → App Layer).
5. Import or create templates (abstract first, then concrete).
6. Add initial source code versions (tag/branch + module path).
7. Enable approval flow (optional policy).
8. Establish naming + tagging conventions.
9. Create abstract resources (Account / Environment).
10. Provision first concrete resource (e.g. VPC) with dry run.
11. Cascade child resources (e.g. VPC → EKS → Namespace).

---

## 🔗 Integrations

### 1.1 Cloud Provider
Configure cloud provider integrations to enable connectivity, management, and automation of workloads across environments.

- Use least‑privilege roles/service principals.
- Separate read vs write if future compliance requires.
- Rotate credentials regularly. Updating integration does not break existing resources.

### 1.2 Git Provider
Add GitHub/Bitbucket/Azure DevOps integration with repo write + PR permissions.

- PAT / App / Service Connection must allow branch create + merge.
- Avoid using personal tokens for long‑term automation.

### 1.3 Auth
Register SSO (GitHub/Microsoft) and tooling (Datadog, MongoDB) as needed for downstream templates.

For more details, see [Integrations Page](../integrations/overview.md).

## 🗂️ Workspaces

Register a pre‑created repository as a workspace to hold generated resource code.

- Keep main branch protected. Approvals occur via PR.
- Repository layout auto: `<template_key>/<resource_name_slug>/`.
- Use CI hooks (lint, policy, security scan) on PRs for infra quality gates.

Branch prefixes:

- `update_` for create/update.
- `delete_` for destroy (code removal).

Workspace usage:

- Review PR for every update/destroy (branch diff shows adds/removals).
- CI gates (format, security scan, policy).
- Merge = approval; close unmerged = reject.
- Drift avoidance: do not hand‑edit generated folders. Push changes via resource update.

For more details, see [Workspace Page](../core-concepts/workspaces/overview.md).

## 🏗️ Template Hierarchy Design

Start abstract → concrete:

1. `aws_account` (abstract)
2. `aws_environment_region` (abstract)
3. `aws_vpc`
4. `eks_cluster`
5. `kubernetes_namespace`. Add others (rds_instance, s3_bucket, alb) under appropriate parent.

Rules:

- Avoid circular parent refs.
- Mark purely structural nodes as abstract.
- Disable templates before large refactors. Re‑enable after validation.

## 📝 Creating Templates

### Option A: Import From Repository
Use existing Terraform/OpenTofu module:

- Provide integration, repo, path, tag/branch.
- Auto analysis extracts variables & outputs.
- Creates initial source code version.

### Option B: Manual Template Then Version
1. Create template metadata (name, key, abstract flag, parents).
2. Add source code version linking repo + module path + tag.

Revision number increments on metadata edits. Resource compatibility unaffected unless parent links change (which gate new resources but not existing ones).

For more details, see [Templates Page](../core-concepts/templates/overview.md).

## 🏷️ Source Code Version Strategy

- Tag per release (e.g. `v1.2.0`).
- Keep variable schema changes backward compatible.
- Test new versions in staging environment resource before promoting to production.

Change process:

1. Add new version.
2. Create staging resource update (dry run → apply).
3. If safe, update production resource referencing new version.

## 🔄 Resource Lifecycle (Engineer View)

| Phase | Action | Key Safety Controls                                           |
|-------|--------|---------------------------------------------------------------|
| Create | Resource record only | Parent state check, variable validation, inheritance applied. |
| Dry Run | Plan | Review adds/changes/destroys. Prevents surprise costs.        |
| Provision | Apply | Isolated execution. Outputs stored.                           |
| Update | Temp state + plan | Diff review + approval (if enabled).                          |
| Destroy | Infra removal, record retained | Child dependency + output usage checks.                       |
| Delete | DB record purge | Only after destroyed. Audit archived.                         |
| Recreate | Re-provision after reject/destroy | Revision increment for traceability.                          |


## 🏢 Abstract Resources First

Create top‑level abstract resources:

- `prod-account`
- `prod-us-east-1` (environment/region)

  Attach:

- Dependency Tags (e.g. `BillingCode=PROD-123` inherited).
- Dependency Configs (e.g. `aws_region=us-east-1`, `name_prefix=prod`).

These automatically seed child variable defaults and enforce uniform tagging.

## 🚀 Provision Concrete Resources

Sequence Example:

1. Create VPC resource under `prod-us-east-1` (inherit region + tags).
2. Dry run → review CIDR correctness + cost tags.
3. Provision → capture outputs (`vpc_id`, `subnet_ids`).
4. Create EKS cluster resource referencing VPC outputs.
5. Provision namespaces referencing cluster outputs.

For more details, see [Resource Page](../core-concepts/resources/overview.md).

## ✏️ Updating Resource

Workflow:

1. Request update → temp state.
2. Adjust variables or source code version.
3. Dry run (plan) → ensure only expected changes.
4. Approval (if enabled) → apply.
5. Outputs refreshed. Revision number increments.

## 🗑️ Destroy & Delete Policy

Recommended:

- Enforce “Destroy before Delete” for audit retention.
- Batch cleanup: destroy leaf resources first; walk upward.

Blocked scenarios:

- Active child `provisioned` resources.
- Downstream dependencies (outputs referenced). Resolve by destroying or detaching dependents.

## 🛡️ Governance & RBAC

Roles (simplified):

- Owner/Admin: approve + destructive actions.
- Write: create/update resources.
- Read: view only.

## 💰 Cost & Compliance Tips

| Goal | Mechanism                                                                    |
|------|------------------------------------------------------------------------------|
| Cost Allocation | Mandatory inherited tags from abstract account/environment.                  |
| Least Privilege | Separate integration per account. Scope permissions.                         |
| Change Audit | Use workspaces + approval flow + revision numbers.                           |
| Cleanup | Scheduled review of `provisioned` but idle resources. Run destroy sequences. |
| Consistency | Abstract configs for shared values (CIDR ranges, region, naming prefix).     |

## 🧰 Troubleshooting Quick Reference

| Symptom | Likely Cause | Action                                                 |
|---------|--------------|--------------------------------------------------------|
| Plan shows unexpected destroys | Variable mismatch or source version drift | Re-check inherited configs. Compare previous revision. |
| Resource stuck `in_progress` | Long apply or state lock | Inspect logs. Wait for known long tasks.               |
| Cannot destroy | Active children or output dependencies | Destroy children first. Clear references.              |
| Variables missing | Source code version analysis failed | Re-analyze. Confirm path & `variables.tf` presence.    |
| PR not created | Existing branch/PR | Approve or close current PR. Retrigger update.         |
| Status `error` after apply | Terraform failure | Review logs. Fix variables/integration. Retry.         |

## 📚 Summary

Establish hierarchy & governance first (abstract resources + tags/configs), then incrementally introduce concrete templates and controlled version updates. Use dry runs, approvals, and workspaces as guardrails. Keep naming/tagging uniform, rotate credentials, and leverage revision + audit trails for accountability.
