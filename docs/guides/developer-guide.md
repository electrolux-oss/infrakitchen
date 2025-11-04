# Developer Guide

This guide shows how to turn infrastructure templates into real cloud resources with **InfraKitchen**. You do not need deep cloud or Terraform/OpenTofu knowledge to follow the steps.

## 💡 Core Ideas (Know These First)

- **Template**: Defines what can be built (the recipe).
- **Source Code Version**: Specific version of IaC code linked to the template.
- **Resource**: A real instance created from a template + version + variables.
- **Variables**: Inputs the code needs (some required, some frozen, some sensitive).
- **Cloud Integrations**: Credentials (AWS, Azure, GCP, etc.).
- **Storage**: Backend for Terraform/OpenTofu state (S3, Blob, GCS).
- **Dependency Tags**: Key/value tags that can flow down to children.
- **Dependency Configs**: Key/value config values that prefill matching variable names for children.
- **Outputs**: Values produced after provisioning (can feed child resources).
- **Abstract Resource**: Organizes hierarchy and passes tags/configs; does not create cloud infra.

## ✅ Prerequisites Checklist

Before creating a non-abstract resource:

- Template exists and is enabled.
- You know which Source Code Version to use.
- Required variables identified.
- Cloud integration(s) available.
- (Optional) Parent resources already provisioned (if template has parents).
- Storage backend configured globally or selectable.

For an abstract resource, integrations and storage are not needed.

## 🚀 Quick Start: Create & Provision

1. Go to Resources.
2. Click Create.
3. Pick a template.
4. Enter:
    - Name (unique within template + version).
    - Description (optional).
    - Parent resources (if required).
5. (Optional) Add dependency tags/configs you want children to inherit.
6. Add labels (e.g. team, env).
7. Select cloud integration(s) (skip for abstract).
8. (Optional) Select workspace.
9. Choose Source Code Version.
10. Fill variables:
    - Required must have values.
    - Sensitive are masked.
    - Frozen cannot change later.
    - Unique must be globally unique for same template.
    - References: may auto\-populate from parent outputs or dependency configs.
11. Save.
12. If approval flow enabled: wait for approval. Else proceed.
13. (Optional) Run Dry Run (Plan) to preview.
14. Click Provision.

Result: State becomes `provisioned`, status `done`. Outputs become available.

## 🧪 Dry Run (Plan) Purpose

Use Dry Run before Provision / Update to see adds, changes, destroys without applying. Fix variable mistakes early.

## 🔗 Using Outputs & References

After provisioning:

- Child resource variables can reference parent outputs.
- Dependency configs with matching names prefill child variable values (override allowed).
- Tags marked inherited flow automatically.

## ✏️ Updating a Resource

You can change: description, variables (not frozen), labels, integrations, workspace, source code version.

Update flow:

1. Start Update.
2. Temp state is created.
3. Review differences (plan optional).
4. If needed, adjust variables.
5. If approval flow: await approval.
6. Apply changes.
7. Revision increments; outputs refresh.

Discard temp state if changes unwanted.

## ♻️ Recreate

Use when resource was destroyed or rejected:

- Triggers provisioning again from existing definition.
- Same steps as initial Provision (approval may apply).

## 🗑️ Destroy vs Delete

- **Destroy**: Removes cloud infra; keeps resource record (state becomes `destroyed`).
- **Delete**: Permanently removes record (only allowed after destroy). Cannot undo.

Destroy rules:

- No child resources still provisioned.
- Approval may be required.
- Outputs cleared after success.

## 🏢 Abstract Resources

When creating an abstract resource:

- Skip integrations, source code version, workspace, variables.
- Use it to group and propagate tags/configs.
- Can have children (abstract or provisioned).
- No Provision / Destroy — only Create, Update, Delete.

## 📋 Lifecycle Cheat Sheet

| Action      | Start State      | End State        | Notes |
|-------------|------------------|------------------|-------|
| Provision   | provision        | provisioned      | Runs IaC apply. |
| Update      | provisioned      | provisioned      | Temp state preview. |
| Recreate    | destroyed/rejected | provisioned    | Fresh apply. |
| Dry Run     | provision/provisioned (pre\-apply) | unchanged | Preview only. |
| Destroy     | provisioned      | destroyed        | Runs IaC destroy. |
| Delete      | destroyed        | (removed)        | Final cleanup. |

## 🏆 Best Practices

- Start with abstract resources for Environment / Account to cascade tags/configs.
- Use Dry Run on updates to avoid surprises.
- Keep naming consistent (include env + region).
- Avoid frequent Source Code Version jumps in production—test on staging first.
- Destroy before Delete to keep audit trail until truly not needed.

## ⏭️ Next Steps

After first resource:

- Create child resources referencing outputs (e.g. VPC → EKS → Namespace).
- Use labels and tags for filtering and cost tracking.
- Explore audit logs for traceability.

---

You can now create, provision, update, and safely retire resources in **InfraKitchen** without deep IaC internals.
For more details, see the [Resources page](../core-concepts/resources/overview.md).
