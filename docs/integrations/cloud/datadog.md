# Datadog

Follow these steps to integrate **Datadog** with **InfraKitchen**.
This integration allows InfraKitchen to use Datadog provider in your terraform/OpenTofu modules.

---

## 1️⃣ Log in to Datadog

1. Go to the [Datadog Dashboard](https://app.datadoghq.com).
2. Sign in using your organization credentials.
3. Ensure you have **Admin** or **API access** privileges in your Datadog account.

---

## 2️⃣ Navigate to API Key Settings

1. From the left sidebar, go to **Organization Settings → API Keys** (or click [here](https://app.datadoghq.com/organization-settings/api-keys)).
2. You’ll see a list of existing API keys for your organization.

---

## 3️⃣ Create a New API Key

1. Click **+ New Key**.
2. Give the key a descriptive name — for example: `infrakitchen-api-key`

3. Click **Create API Key**.
4. Copy the **API Key** value — you’ll need this for the InfraKitchen configuration.

---

## 4️⃣ Navigate to Application Keys

1. In the same **API Keys** page, switch to the **Application Keys** tab.
   (You can also access it via [https://app.datadoghq.com/organization-settings/application-keys](https://app.datadoghq.com/organization-settings/application-keys))
2. Click **+ New Key**.

---

## 5️⃣ Create an Application Key

1. Enter a descriptive name — e.g.: `infrakitchen-app-key`

2. Optionally, assign the key to a specific user (recommended for auditing).
3. Click **Create Application Key**.
4. Copy the **Application Key** value.

---

## 6️⃣ Collect Required Information

Before proceeding, make sure you have:

| Required Value       | Description                                                                            |
| -------------------- | -------------------------------------------------------------------------------------- |
| **API Key**          | Used for authenticating API requests from InfraKitchen to Datadog                      |
| **APP Key**  | Allows InfraKitchen to access dashboards, monitors, and metric data                    |
| **Datadog API URL** | Usually `https://datadoghq.com` (but may vary, e.g. `https://datadoghq.eu`, `https://us3.datadoghq.com`, etc.) |

---

## 7️⃣ Fill Out the InfraKitchen Integration Form

InfraKitchen path: `/integrations/datadog/setup`

Then fill in the following fields:

| Field                | Description                                               |
| -------------------- | --------------------------------------------------------- |
| **Integration Name** |  A unique name for this integration (e.g., `datadog-prod`) |
| **Description**      | Brief description of your Datadog environment             |
| **Labels**           | Add tags like `observability`, `monitoring`, or `prod`    |
| **Datadog Site URL** |  Domain of your Datadog instance (e.g. `https://datadoghq.com`)    |
| **API Key**          |  The API key you created in Step 3                         |
| **Application Key**  |  The Application key you created in Step 5                 |

---

## 8️⃣ Test the Connection

1. Click **Test Connection**.
2. InfraKitchen will attempt to connect to Datadog’s API endpoint using the keys provided.
3. If successful, you’ll see a confirmation message.
4. If the test fails, verify:

   - The **API Key** and **Application Key** are correct.
   - The **Datadog Site URL** matches your region.
   - The Application Key user has sufficient permissions.
