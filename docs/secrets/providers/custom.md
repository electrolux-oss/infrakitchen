# Custom Secrets

Custom secrets in InfraKitchen allow you to store arbitrary key-value pairs encrypted within the InfraKitchen database. This is ideal for secrets that don't need to be stored in cloud provider secret managers.

---

## 🎯 When to Use Custom Secrets

Use custom secrets when:

- ✅ You don't have cloud provider integrations set up
- ✅ Secrets are specific to InfraKitchen and not shared with other systems
- ✅ You want centralized secret management within InfraKitchen
- ✅ You need quick, simple secret storage without external dependencies
- ✅ You're in a development or testing environment

**Don't use custom secrets when:**

- ❌ You need secret rotation from external systems
- ❌ You need to share secrets across multiple systems

---

## 🔐 Security Model

### Encryption

- All secret values are encrypted at rest using **AES-256 encryption**
- Encryption key is configured via the `ENCRYPTION_KEY` environment variable
- Decryption happens only in-memory during resource provisioning
- Encrypted values are never logged or exposed in the UI

### Access Control

- Only platform engineers can create/modify secrets
- RBAC enforced at the application level
- Audit logs track all secret operations
- Secret values are never returned in API responses

---

## 📝 Creating Custom Secrets

Navigate to InfraKitchen: `/secrets/create`

### Required Configuration

| Field | Description | Example |
| :--- | :--- | :--- |
| **Name** | Unique identifier in InfraKitchen | `app-database-credentials` |
| **Secret Type** | Type of secret | `tofu` (only option currently) |
| **Secret Provider** | Provider type | `custom` |
| **Secrets** | Array of key-value pairs | See examples below |

### Secret Structure

Each custom secret contains an array of key-value pairs:

```yaml
name: my-custom-secret
secret_type: tofu
secret_provider: custom
configuration:
  secrets:
    - name: DATABASE_URL
      value: postgresql://user:pass@host:5432/db
    - name: API_KEY
      value: abc123xyz789
    - name: ENCRYPTION_KEY
      value: super-secret-key-here
  secret_provider: custom
```

### Optional Configuration

| Field | Description | Example |
| :--- | :--- | :--- |
| **Description** | Purpose and usage notes | `Application configuration secrets` |
| **Labels** | Tags for organization | `development`, `database`, `api` |

---

## 🛠️ Managing Custom Secrets

### Create

1. Navigate to Secrets → Create
2. Select **Custom** as secret provider
3. Add key-value pairs:
   - Click "Add Secret"
   - Enter **Name** (key)
   - Enter **Value** (will be encrypted)
   - Repeat for additional secrets
4. Add description and labels
5. Save

### Update

To update custom secret values:

1. Edit the existing secret
2. Modify the configuration:
   - Update existing key-value pairs
   - Add new pairs
   - Remove unwanted pairs
3. Save changes

### Delete

Before deleting:

1. Verify no resources reference the secret
2. Update or destroy dependent resources

---

### How It Works

During resource provisioning:

1. **Reference Resolution** - InfraKitchen identifies referenced secrets
2. **Decryption** - Secret values are decrypted in-memory
3. **Variable Injection** - Secrets are passed to Terraform/OpenTofu as variables (with `TF_VAR_` prefix)
4. **Provisioning** - Infrastructure is created with secret values
5. **Cleanup** - Decrypted values are cleared from memory

!!! warning "Variable Naming"
    Ensure that the variable names in your Terraform/OpenTofu code match the secret keys defined in the custom secret.

### Terraform/OpenTofu Integration

Custom secrets are made available as Terraform variables:

```hcl
# Terraform automatically receives these as variables
variable "db_host" {
  type      = string
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
}

# Use in resources
resource "kubernetes_secret" "db_credentials" {
  metadata {
    name = "db-credentials"
  }

  data = {
    host     = var.db_host
    password = var.db_password
  }
}
```
