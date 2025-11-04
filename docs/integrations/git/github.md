# GitHub

Integrate **GitHub** with **InfraKitchen** to enable repository access.
This integration allows InfraKitchen to read repositories, fetch configurations, and optionally create pull requests as part of your automation pipelines.

---

## 1️⃣ Go to GitHub Personal Access Tokens

1. Log in to [GitHub](https://github.com).
2. Click your **profile icon** in the top-right corner → **Settings**.
3. In the left sidebar, navigate to **Developer settings → Personal access tokens → Tokens (classic)** or **Fine-grained tokens**.
4. Click **Generate new token** (choose **Fine-grained token** if possible for better security).

---

## 2️⃣ Name Your Token

Give your token a clear, descriptive name — for example:

```
InfraKitchen Integration
```

This helps identify its purpose later when rotating or revoking tokens.
Set expiration according to your organization’s security policies.

---

## 3️⃣ Set Repository Permissions

Under **Repository permissions**, grant at least the following:

| Permission   | Level | Description                                                     |
| ------------ | ----- | --------------------------------------------------------------- |
| **Contents** | Read  | Allows InfraKitchen to read repository files and configurations |
| **Metadata** | Read  | Required for InfraKitchen to identify and index repositories    |

If InfraKitchen will **create pull requests**, also enable:

| Permission        | Level | Description                                             |
| ----------------- | ----- | ------------------------------------------------------- |
| **Pull requests** | Write | Allows InfraKitchen to open pull requests automatically |

---

## 4️⃣ Add the Token to InfraKitchen

InfraKitchen path: `/integrations/github/setup`

| Field                      | Description                                                                 |
| -------------------------- | --------------------------------------------------------------------------- |
| **Integration Name**       |  A unique name for this integration (e.g., `github-prod`)                    |
| **Description**            | A short description (e.g., “InfraKitchen GitHub integration for IaC repos”) |
| **Labels**                 | Tags such as `github`, `repository`, or `infra`                             |
| **GitHub Token**           |  Paste the Personal Access Token you generated                               |

---

## 5️⃣ Test the Connection

Click **Test Connection** in the InfraKitchen setup form.
InfraKitchen will validate the GitHub token and access scope.

If the connection fails:

- Verify the **token** is correct and not expired.
- Ensure the **repository access** matches your target repos.
- Confirm the **Contents** and **Metadata** permissions are enabled.

---

## 🔐 GitHub SSH (Alternative Connection Method)

InfraKitchen can also use **SSH** to connect to your GitHub repositories. This typically involves generating an SSH key pair and adding the public key to your GitHub account settings, which is an alternative to using an API Token for repository access.
