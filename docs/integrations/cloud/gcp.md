# Google Cloud

Follow these steps to integrate **Google Cloud Platform (GCP)** with InfraKitchen.
This integration enables InfraKitchen to manage your GCP resources, automate deployments, and optionally create remote storage for OpenTofu/Terraform state management.

---

## 1️⃣ Log in to Google Cloud Console

1. Open [https://console.cloud.google.com](https://console.cloud.google.com).
2. Make sure you’re in the correct **project** or create a new one for InfraKitchen.
3. Note down your **Project ID** — you’ll need this later in the setup form.

---

## 2️⃣ Create a Service Account

1. In the Google Cloud Console, navigate to **IAM & Admin** → **Service Accounts**.
2. Click **+ CREATE SERVICE ACCOUNT**.
3. Enter a name such as `infrakitchen-integration`.
4. Optionally, add a description (e.g., “InfraKitchen GCP integration account”).
5. Click **Create and Continue**.

---

## 3️⃣ Assign Permissions to the Service Account

1. On the “Grant this service account access” step, assign roles that match what InfraKitchen should manage.
   Common roles include:

   - **Viewer** – read-only access
   - **Editor** – full project-level management
   - **Storage Admin** – required if InfraKitchen will manage or create GCS buckets (for Terraform remote state)
   - **Compute Admin** – if InfraKitchen will manage compute instances
   - **Service Account User** – if InfraKitchen needs to deploy or impersonate other service accounts

2. Click **Continue** and **Done**.

_You can add or modify roles later in the IAM permissions page if needed._

---

## 4️⃣ Generate a Service Account Key (JSON)

1. From the list of service accounts, click the newly created one.
2. Go to the **Keys** tab.
3. Click **Add Key → Create new key**.
4. Choose **JSON** as the key type and click **Create**.
5. The JSON key file will be downloaded automatically — **store it securely**.
6. You’ll need the full JSON content for the InfraKitchen configuration.

---

## 5️⃣ Enable Required APIs

InfraKitchen requires certain GCP APIs to be enabled for management tasks.
In the Google Cloud Console, navigate to **APIs & Services → Library** and enable at least:

- **Cloud Resource Manager API**
- **Compute Engine API** (if managing compute resources)
- **Cloud Storage API** (if using remote state storage)
- **IAM API**

---

## 6️⃣ Fill Out the InfraKitchen Integration Form

InfraKitchen path: `/integrations/gcp/setup`

In InfraKitchen, go to **Integrations → Cloud → Google Cloud** and complete the fields:

| Field                                                                | Description                                                          |
| -------------------------------------------------------------------- |-------------------------------------------------------------------- |
| **Integration Name**                                                 | A unique name for this integration (e.g., `gcp-production`)          |
| **Description**                                                      |A short description of your integration                              |
| **Labels**                                                           |Add labels such as `production`, `gcp`, `terraform`                  |
| **GCP Project ID**                                                   | Your GCP project’s unique ID                                         |
| **GCP Service Account Key**                                          | Paste the entire JSON key content you downloaded earlier             |
| **Automatically create storage for OpenTofu/Terraform remote state** |When enabled, InfraKitchen will create a GCS bucket for remote state |

---

## 7️⃣ Test the Connection

1. After entering all required fields, click **Test Connection**.
2. InfraKitchen will verify the Service Account credentials and API access.
3. If the connection test fails:

   - Ensure the **Service Account Key JSON** is correctly formatted and valid.
   - Confirm that the **required APIs** are enabled.
   - Check that the **roles** assigned to the Service Account include the necessary permissions.
