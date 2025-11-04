# Azure

Follow these steps to integrate **Microsoft Azure** with InfraKitchen.
This integration allows InfraKitchen to authenticate securely with Azure Resource Manager (ARM) to manage and automate your Azure infrastructure.

---

## 1️⃣ Log in to the Azure Portal

1. Open [https://portal.azure.com](https://portal.azure.com).
2. From the left-hand menu, select **Azure Active Directory**.

---

## 2️⃣ Create an App Registration

1. In **Azure Active Directory**, navigate to **App registrations**.
2. Click **+ New registration**.
3. Enter a descriptive name such as `InfraKitchen-Integration`.
4. Choose **Accounts in this organizational directory only** (default).
5. Leave the redirect URI blank (not required for this integration).
6. Click **Register**.

Once created, the overview page will show the following identifiers:

* **Application (client) ID**
* **Directory (tenant) ID**

**Note:** Copy both the **Client ID** and **Tenant ID** — you will need them later in the InfraKitchen setup form.

---

## 3️⃣ Create a Client Secret

1. From your App Registration page, navigate to **Certificates & secrets**.
2. Under **Client secrets**, click **+ New client secret**.
3. Add a description (e.g., “InfraKitchen access key”).
4. Set an expiration (recommended: 1 year or 2 years).
5. Click **Add**.
6. Copy the **Value** of the client secret immediately — this value will only be shown once.

**You will need this value for the `Client Secret` field** in InfraKitchen.

---

## 4️⃣ Assign Roles and Permissions

To allow InfraKitchen to manage Azure resources, the App Registration must have appropriate permissions:

1. In the **Azure Portal**, navigate to **Subscriptions** (or the specific resource group you want to manage).
2. Select the target subscription or resource group.
3. Go to **Access control (IAM)** → **Add role assignment**.
4. Choose a role appropriate to the level of access required, such as:
      * **Contributor** (recommended for full management)
      * **Reader** (for read-only access)
5. In the **Members** tab, select **User, group, or service principal**.
6. Search for your App Registration name and select it.
7. Click **Next** and **Assign**.

---

## 5️⃣ Fill Out the InfraKitchen Integration Form

InfraKitchen path: `/integrations/azurerm/setup`

You should now have the following four key values ready:

| Field               | Description                                            | Example                                |
| ------------------- | ------------------------------------------------------ | -------------------------------------- |
| **Client ID**       | The Application (client) ID from your App Registration | `11111111-2222-3333-4444-555555555555` |
| **Subscription ID** | The Azure subscription ID where you assigned the role  | `66666666-7777-8888-9999-000000000000` |
| **Tenant ID**       | The Directory (tenant) ID from your App Registration   | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` |
| **Client Secret**   | The secret value generated in Certificates & Secrets   | `xYz12345SecretValueOnlyShownOnce`     |

---

## 6️⃣ Test the Connection

1. After filling out all required fields, click **Test Connection**.
2. InfraKitchen will attempt to authenticate to Azure Resource Manager using your credentials.
3. If successful, a confirmation message will appear.
4. If it fails:

    * Verify that the **Client ID**, **Tenant ID**, and **Client Secret** are correct.
    * Ensure the App Registration has the proper IAM role on the target subscription.
    * Check that the secret has not expired.
