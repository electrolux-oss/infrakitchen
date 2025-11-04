# Bitbucket

This document provides instructions on how to set up **Bitbucket API integration** for **InfraKitchen** to enable repository access, branch management, and optional pull request creation within your automation pipelines.

## 1️⃣ Go to Bitbucket API Tokens

1. Log in to **Atlassian** and navigate to your account security settings.
2. Go to the **API tokens** page.
   - [**API Token creation page**](https://id.atlassian.com/manage-profile/security/api-tokens)
3. Click **Create API token**.

---

## 2️⃣ Name Your Token and Set Permissions

Give your token a clear, descriptive **Label** — for example:

    ```
    InfraKitchen Integration
    ```

This helps identify its purpose later when rotating or revoking tokens.

Under **Permissions**, grant the necessary scopes for InfraKitchen to function.

### Scopes for Repository Read Access

To allow InfraKitchen to **read repositories**, **fetch configurations**, and **index repositories**, grant at least the following **Read** scopes:

| Scope | Description |
| :--- | :--- |
| **read:project:bitbucket** | Allows InfraKitchen to read project details. |
| **read:repository:bitbucket** | Allows InfraKitchen to read repository files and configurations. |
| **read:user:bitbucket** | Required for identifying the user associated with the token. |
| **read:workspace:bitbucket** | Required for InfraKitchen to identify and index repositories. |

### Scopes for Pull Request Management

If InfraKitchen will **create pull requests** or **manage branches**, also enable the following **Write** scopes:

| Scope | Description |
| :--- | :--- |
| **read:pullrequest:bitbucket** | Allows InfraKitchen to read pull request details. |
| **write:pullrequest:bitbucket** | Allows InfraKitchen to **open pull requests** automatically. |
| **write:repository:bitbucket** | Allows InfraKitchen to create/manage branches and update repositories. |

Click **Create**. **Copy the generated token immediately** as you won't be able to see it again.

---

## 3️⃣ Add the Token to InfraKitchen

InfraKitchen path: `/integrations/bitbucket/setup`

| Field | Description |
| :--- | :--- |
| **Integration Name** | A unique name for this integration (e.g., `bitbucket-prod`) |
| **Description** | A short description (e.g., “InfraKitchen Bitbucket integration for IaC repos”) |
| **Labels** | Tags such as `bitbucket`, `repository`, or `infra` |
| **User Email** | User email associated with the Bitbucket account |
| **Bitbucket API Token** | **Paste the API Token you generated** from Atlassian |

---

## 4️⃣ Test the Connection

Click **Test Connection** in the InfraKitchen setup form.
InfraKitchen will validate the Bitbucket API token and its access scopes.
If the connection fails:

- Verify the **token** is correct and not expired.
- Ensure the **required scopes** (`read:project`, `read:repository`, etc.) are correctly enabled on the token.
- If using optional features, confirm the necessary **Write** scopes are present.

---

## 🔐 Bitbucket SSH (Alternative Connection Method)

InfraKitchen can also use **SSH** to connect to your Bitbucket repositories. This typically involves generating an SSH key pair and adding the public key to your Bitbucket account settings, which is an alternative to using an API Token for repository access.
