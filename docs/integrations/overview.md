# Integrations

Integrations are the foundation of InfraKitchen's connectivity to external systems. They securely store credentials and configuration needed to interact with cloud providers, Git repositories, and authentication systems.

---

## 🎯 What are Integrations?

An **Integration** in InfraKitchen is a secure record that contains:

- **Connection details** (URLs, endpoints, account IDs)
- **Authentication credentials** (API keys, tokens, OAuth credentials)
- **Configuration settings** (regions, scopes, permissions)

All credentials are **encrypted at rest** and decrypted only when needed for operations.

---

## 🔍 Integration Properties

All integrations share common properties:

| Property          | Description                           | Required |
| ----------------- | ------------------------------------- | -------- |
| **Name**          | Human-readable identifier             | ✅       |
| **Type**          | Cloud/Git/Auth provider               | ✅       |
| **Provider**      | Specific provider (AWS, GitHub, etc.) | ✅       |
| **Configuration** | Provider-specific settings            | ✅       |
| **Description**   | Purpose and usage notes               | ❌       |

---

## 🛠️ Managing Integrations

### Create

Only platform engineers can create integrations:

1. Navigate to Integrations page
2. Click "Create Integration"
3. Select provider type
4. Fill in required fields
5. Test connection (if applicable)
6. Save

### Update

Credentials can be rotated without affecting resources:

1. Edit existing integration
2. Update credentials
3. Save
4. Existing resources continue working

### Delete

⚠️ **Warning:** Deleting an integration will prevent resources using it from being provisioned or destroyed.

Before deletion:

- Ensure no resources reference it
- Update or destroy dependent resources
- Document the change

---

## 📚 Provider-Specific Guides

### Cloud Providers

- [AWS Setup Guide](./cloud/aws.md) - IAM roles, permissions, and best practices
- [Azure Setup Guide](./cloud/azure.md) - Service principals and RBAC
- [GCP Setup Guide](./cloud/gcp.md) - Service accounts and IAM
- [MongoDB Atlas Guide](./cloud/mongodb.md) - API keys and project setup
- [Datadog Guide](./cloud/datadog.md) - API and application keys

### Git Providers

- [GitHub Setup Guide](./git/github.md) - OAuth apps, PATs, and permissions
- [Bitbucket Setup Guide](./git/bitbucket.md) - App passwords and OAuth
- [Azure DevOps Guide](./git/azure-devops.md) - PATs and service connections

### Auth Providers

- [GitHub OAuth Setup](./auth/github.md) - App registration and scopes
- [Microsoft OAuth Setup](./auth/microsoft.md) - App registration and Azure AD
- [Backstage Integration](./auth/backstage.md) - Plugin configuration
- [Service Accounts](./auth/service-account.md) - API token management
- [Guest Access](./auth/guest.md) - Development mode
