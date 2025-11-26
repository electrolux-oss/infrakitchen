# Secrets

Secrets in InfraKitchen provide a secure way to manage sensitive configuration data required by your infrastructure resources. They enable safe storage and retrieval of credentials, API keys, and other sensitive values needed during resource provisioning.

---

## 🎯 What are Secrets?

A **Secret** in InfraKitchen is a secure storage mechanism that contains:

- **Sensitive configuration values** (passwords, API keys, tokens)
- **Cloud provider secrets** (AWS Secrets Manager, GCP Secret Manager)
- **Custom key-value pairs** for application configuration
- **Provider-specific settings** (regions, resource groups, account names)

All secret values are **encrypted at rest** using industry-standard encryption and are decrypted only when needed during resource provisioning.

---

## 🔍 Secret Properties

All secrets share common properties:

| Property              | Description                                     | Required |
| --------------------- | ----------------------------------------------- | -------- |
| **Name**              | Human-readable identifier                       | ✅       |
| **Secret Type**       | Type of secret (currently only `tofu` supported)| ✅       |
| **Secret Provider**   | Provider (AWS, GCP, Custom)              | ✅       |
| **Configuration**     | Provider-specific settings                      | ✅       |
| **Integration**       | Associated cloud integration (if applicable)    | ❌       |
| **Description**       | Purpose and usage notes                         | ❌       |
| **Labels**            | Tags for categorization and filtering           | ❌       |

---

## 📦 Secret Providers

InfraKitchen supports multiple secret storage providers:

### Cloud-Native Providers

| Provider | Description | Use Case |
| -------- | ----------- | -------- |
| **AWS** | AWS Secrets Manager | Store secrets in AWS for resources deployed to AWS |
| **GCP** | GCP Secret Manager | Store secrets in GCP for GCP-deployed resources |

### Custom Provider

| Provider | Description | Use Case |
| -------- | ----------- | -------- |
| **Custom** | InfraKitchen-managed key-value pairs | Store arbitrary secrets encrypted within InfraKitchen |

---

## 🔐 How Secrets Work

### Creation Flow

1. **Create Secret** → Choose provider and configure settings
2. **Encryption** → Values are encrypted using your encryption key
3. **Storage** → Encrypted data is stored in InfraKitchen database
4. **Reference** → Resources reference secrets in their configuration

### Usage Flow

1. **Resource Provisioning** → Resource references a secret
2. **Authentication** → InfraKitchen authenticates to secret provider (if cloud-based)
3. **Retrieval** → Secret values are fetched and decrypted
4. **Injection** → Values are injected into Terraform/OpenTofu as variables (setup variables with TF_VAR_ prefix)
5. **Cleanup** → Decrypted values exist only in memory during execution

---

## 🛠️ Managing Secrets

### Create

Only platform engineers can create secrets:

1. Navigate to Secrets page
2. Click "Create Secret"
3. Select secret provider (AWS, GCP, or Custom)
4. Fill in required configuration fields
5. (Optional) Link to a cloud integration
6. Add labels for organization
7. Validate and save

### Update

Secrets can be updated to modify values or configuration:

1. Edit existing secret
2. Update description or labels
3. Modify configuration (provider-dependent)
4. Save changes
5. Resources will use updated values on next provision

!!! warning "Provider and Type Cannot Change"
    The `secret_provider` and `secret_type` fields are immutable after creation. To change providers, create a new secret.

### Delete

⚠️ **Warning:** Deleting a secret will prevent resources using it from being provisioned.

Before deletion:

- Ensure no resources reference it
- Update or destroy dependent resources
- Document the change
- Consider disabling instead of deleting

### Disable/Enable

Secrets can be disabled without deletion:

- **Disabled secrets** cannot be used by new resource provisions
- Existing resources retain their configuration
- Can be re-enabled at any time

## 📚 Provider-Specific Guides

### Cloud Provider Secrets

- [AWS Secrets Manager](./providers/aws.md) - AWS Secrets Manager integration
- [GCP Secret Manager](./providers/gcp.md) - GCP Secret Manager configuration

### Custom Secrets

- [Custom Secrets](./providers/custom.md) - InfraKitchen-managed key-value pairs

---

## 🆘 Troubleshooting

Common issues and solutions:

| Issue | Possible Cause | Solution |
| ----- | -------------- | -------- |
| Cannot create secret | Missing permissions | Verify platform engineer role |
| Secret not found during provision | Name mismatch | Check secret name matches resource reference |
| Cloud provider secret fails | Invalid integration | Verify integration credentials and permissions |
| Encryption error | Missing encryption key | Configure `ENCRYPTION_KEY` environment variable |
