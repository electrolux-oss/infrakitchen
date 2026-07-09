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

## 4️⃣ Choose an Authentication Method

InfraKitchen supports two authentication methods for GCP integrations:

- **Service Account Key** - paste a service account JSON key.
- **Workload Identity Federation (OIDC)** - InfraKitchen acts as the OIDC identity provider and mints the federation token for you. You only provide the provider audience (and optionally a service account to impersonate).

Choose the method that matches your setup and follow the relevant section below.

---

## 5️⃣ Option A: Generate a Service Account Key (JSON)

1. From the list of service accounts, click the newly created one.
2. Go to the **Keys** tab.
3. Click **Add Key → Create new key**.
4. Choose **JSON** as the key type and click **Create**.
5. The JSON key file will be downloaded automatically — **store it securely**.
6. You’ll need the full JSON content for the InfraKitchen configuration.

---

## 6️⃣ Option B: Workload Identity Federation via InfraKitchen-issued OIDC

Use this option to let InfraKitchen issue the OIDC token itself — you don't paste any credential config or manage a subject token source. InfraKitchen generates a dedicated signing keypair per integration, publishes the public keys as a JWKS, and mints a short-lived signed token at run time.

> **Prerequisite:** the `INFRAKITCHEN_URL` setting must be configured with the externally-visible base URL of InfraKitchen (e.g. `https://infrakitchen.example.com`). It is used as the OIDC issuer.

1. In InfraKitchen, create the GCP integration with **Authentication Method = Workload Identity Federation (OIDC)**, fill in the **GCP Project ID** and **GCP WIF Pool Provider Audience**, and save it. Saving generates the signing keypair.
2. Open the saved integration page and copy the **OIDC Issuer URL** shown in the configuration.
3. In Google Cloud IAM, create a **Workload Identity Pool**, then add an **OIDC** provider:
   - **Issuer (URL):** paste the InfraKitchen **OIDC Issuer URL**.
   - **JWK file (JSON):** leave empty if InfraKitchen is publicly reachable by GCP (GCP fetches the keys from the issuer). If InfraKitchen is **not** publicly reachable, click **Download JWKS** on the integration page and upload that file here.
   - **Audiences:** use the default audience, or add an allowed audience that matches the value you entered in **GCP WIF Pool Provider Audience**.
   - Configure attribute mapping, e.g. `google.subject = assertion.sub`.
4. Grant access to the federated principal:
    - Grant IAM roles directly to the principal, **or**
    - Set **GCP Service Account Email** in the InfraKitchen form and grant that principal `roles/iam.workloadIdentityUser` on the service account (InfraKitchen will impersonate it).
5. Click **Test Connection** on the integration page to verify.

Notes:

- The **GCP WIF Pool Provider Audience** is the full canonical provider resource name, e.g. `//iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID`.
- InfraKitchen mints the token per host at run time, so this works for validation, GCS remote state, Secret Manager, and OpenTofu runs.
- For direct federation (no **GCP Service Account Email**), grant IAM roles directly to the federated principal. For example:

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="principal://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/subject/SUBJECT" \
  --role="roles/browser"
```

- To grant the role to the whole pool instead of one subject:

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/*" \
  --role="roles/browser"
```

- `roles/browser` includes `resourcemanager.projects.get`, which InfraKitchen uses during **Test Connection**.
- If you enable automatic OpenTofu/Terraform remote state storage with WIF, the federated principal or impersonated service account also needs Cloud Storage create and read permissions so InfraKitchen can create and inspect the GCS bucket.

  Grant those permissions with `gcloud`, for example:

```bash
# Direct federation: grant project-level Cloud Storage permissions to the whole WIF pool
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/*" \
  --role="roles/storage.admin"

# Or grant them to the impersonated service account used by InfraKitchen
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.admin"
```

  `roles/storage.admin` covers bucket creation and read access required for automatic remote state bucket setup.

---

## 7️⃣ Enable Required APIs

InfraKitchen requires certain GCP APIs to be enabled for management tasks.
In the Google Cloud Console, navigate to **APIs & Services → Library** and enable at least:

- **Cloud Resource Manager API**
- **Compute Engine API** (if managing compute resources)
- **Cloud Storage API** (if using remote state storage)
- **IAM API**

---

## 8️⃣ Fill Out the InfraKitchen Integration Form

InfraKitchen path: `/integrations/gcp/setup`

In InfraKitchen, go to **Integrations → Cloud → Google Cloud** and complete the fields:

| Field                                                                | Description                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Integration Name**                                                 | A unique name for this integration (e.g., `gcp-production`)          |
| **Description**                                                      | A short description of your integration                              |
| **Labels**                                                           | Add labels such as `production`, `gcp`, `terraform`                  |
| **Authentication Method**                                            | Choose `Service Account Key` or `Workload Identity Federation (OIDC)` |
| **GCP Project ID**                                                   | Your GCP project's unique ID                                         |
| **GCP Service Account Key**                                          | Paste the full service account JSON key when using key auth          |
| **GCP WIF Pool Provider Audience**                                   | (OIDC) Full provider resource name used as the token audience       |
| **GCP Service Account Email**                                        | (OIDC, optional) Service account to impersonate after federation    |
| **Service Account Impersonation URL**                                | (OIDC, optional) Exact `service_account_impersonation_url` override |
| **Automatically create storage for OpenTofu/Terraform remote state** | When enabled, InfraKitchen will create a GCS bucket for remote state |

---

## 9️⃣ Test the Connection

1. After entering all required fields, click **Test Connection**.
2. InfraKitchen will verify the provided GCP credentials and API access.
3. If the connection test fails:

   - Ensure the **Service Account Key JSON** or **WIF Credential Config JSON** is correctly formatted and valid.
   - Confirm that the **required APIs** are enabled.
   - Check that the assigned **roles** include the necessary permissions.
   - For WIF, confirm that the referenced token source is available from the InfraKitchen runtime environment.
