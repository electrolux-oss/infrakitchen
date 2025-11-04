# Azure DevOps

Follow these steps to integrate **Azure DevOps** with **InfraKitchen**.
This integration enables InfraKitchen to connect with your Azure DevOps organization for repositories.

---

## 1️⃣ Log in to Azure DevOps

1. Go to [https://dev.azure.com](https://dev.azure.com) or to the link used by your organization.
2. Sign in using your Microsoft account credentials.

---

## 2️⃣ Get Your Azure DevOps Organization Name

1. Once signed in, look at the URL in your browser.
   It will look like: `https://dev.azure.com/<organization-name>/`

2. Copy the **organization name** — this is required in the InfraKitchen configuration.

---

## 3️⃣ Generate a Personal Access Token (PAT)

1. Go to User settings → Personal access tokens → New Token in your Azure DevOps account.
2. Enter a descriptive name such as: `InfraKitchen Integration Token`

3. Set an **Expiration** — e.g., 90 or 180 days (depending on your security policy).
4. Assign permissions in the **Scopes** section. **Code (Read, write & manage)** is required for repository access.

---

## 4️⃣ Fill Out the InfraKitchen Integration Form

InfraKitchen path: `/integrations/azure_devops/setup`

| Field                 |Description                                                    |
| --------------------- |-------------------------------------------------------------- |
| **Integration Name**  | A unique name for this integration (e.g., `azure-devops-prod`) |
| **Description**       |A short description for your integration                       |
| **Labels**            |Add tags such as `ci-cd`, `devops`, or `infra`                 |
| **Azure Organization** | Your Azure DevOps organization name (e.g., `infrakitchen`)       |
| **Azure Access Token** | The PAT generated in Step 3                                    |

---

## 5️⃣ Test the Connection

Click **Test Connection** in the InfraKitchen setup form.
InfraKitchen will use your Organization Name and PAT to validate API access.

If the test fails:

- Ensure your **PAT** hasn’t expired and includes required scopes.
- Verify that the **Organization Name** matches exactly as shown in the URL.

---

## 🔐 Azure DevOps SSH

InfraKitchen can also use SSH to connect to your DevOps repositories.
