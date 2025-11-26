# GCP Secret Manager

Follow these steps to create and configure a GCP Secret Manager secret in InfraKitchen. This allows your resources to securely retrieve secrets stored in Google Cloud Secret Manager.

---

## 1️⃣ Prerequisites

Before creating a GCP secret in InfraKitchen:

1. **GCP Integration** - Create a GCP integration with appropriate permissions
2. **Secret Manager API** - Enable the Secret Manager API in your GCP project
3. **Service Account** - Ensure the service account has secret access permissions
4. **Secret Created in GCP** - Create the actual secret in GCP Secret Manager first

---

## 2️⃣  Required IAM Permissions

The GCP service account used by the integration must have these roles:

### Secret Manager Roles

- **Secret Manager Secret Accessor** (`roles/secretmanager.secretAccessor`) - To read secret values
- **Secret Manager Viewer** (`roles/secretmanager.viewer`) - To list and view secret metadata

---

## 3️⃣ Configure Secret in InfraKitchen

Navigate to InfraKitchen: `/secrets/create`

### Required Configuration

| Field | Description | Example |
| :--- | :--- | :--- |
| **Name** | Unique identifier in InfraKitchen | `prod-gcp-database-creds` |
| **Secret Type** | Type of secret | `tofu` (only option currently) |
| **Integration** | Link to GCP integration | Select your GCP integration |
| **Secret Provider** | Cloud provider | `gcp` |
| **Secret Name** | Exact name of secret in GCP Secret Manager | `infrakitchen-production-database` |

### Optional Configuration

| Field | Description | Example |
| :--- | :--- | :--- |
| **GCP Region** | Specific region (if using user-managed replication) | `us-central1`, `europe-west1` |
| **Description** | Purpose and usage notes | `Production database credentials` |
| **Labels** | Tags for organization | `production`, `database`, `critical` |

!!! info "Region Parameter"
    The `gcp_region` field is optional. If not specified, GCP will use the automatic replication policy. Set it only if you need to access a secret from a specific region with user-managed replication.

---

## 🐛 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
| ----- | ----- | -------- |
| **Permission denied** | Missing IAM role | Grant `secretmanager.secretAccessor` role |
| **Secret not found** | Wrong project or name | Verify project ID and secret name match |
| **API not enabled** | Secret Manager API disabled | Enable `secretmanager.googleapis.com` API |
| **Region mismatch** | Wrong region specified | Check secret replication configuration |
| **Version not found** | All versions disabled | Enable at least one secret version |

---

## 📚 Additional Resources

- [GCP Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Secret Manager IAM Permissions](https://cloud.google.com/secret-manager/docs/access-control)
- [GCP Integration Guide](../../integrations/cloud/gcp.md)
