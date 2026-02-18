# GitLab

Integrate **GitLab** with **InfraKitchen** to enable repository access.
This integration allows InfraKitchen to read repositories and fetch configurations.
Creating merge requests as part of your automation pipelines is not yet implemented.

---

## 1️⃣ Get a Token From GitLab (Cloud or Private)

The Personal Access Token way:

This is the simplest way to import modules from projects the user has access.

1. Log in to [GitLab](https://gitlab.com) or your own private instance.
2. Click your **profile icon** in the top-left corner → **Edit Profile**.
3. In the left sidebar, navigate to **Personal access tokens**.
4. Click **Add new token**.

The Group (or Project) Access Token way:

Choose this method if you prefer to restrict access to a particular group of projects on GitLab regardless the access your user may have.

1. Log in to [GitLab](https://gitlab.com) or your own private instance.
2. Click on a **group** you want **InfraKitchen** to access.
3. In the left sidebar, click on **Settings** → **Access tokens**.
4. Click **Add new token**.

---

## 2️⃣ Name Your Token

Give your token a clear, descriptive name — for example:

```
InfraKitchen Integration
```

This helps identify its purpose later when rotating or revoking tokens.
Set expiration according to your organization’s security policies.

---

## 3️⃣ Set Scopes

Under **Select scopes**, grant at least the following:

| Scope               | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| **read_repository** | Allows InfraKitchen to read repository files and configurations |
| **read_api**        | Required for InfraKitchen to identify and index repositories    |

Instead, if InfraKitchen will also **create merge requests**:

| Scope                | Description                                              |
| -------------------- | -------------------------------------------------------- |
| **api**              | Allows InfraKitchen to open merge requests automatically |
| **write_repository** | Allows InfraKitchen to open merge requests automatically |

Specific to Group or Project access tokens:

* Select a role fitting the use case (most of the time `Developer`).

---

## 4️⃣ Add the Token to InfraKitchen

InfraKitchen path: `/integrations/gitlab/setup`

| Field                      | Description                                                                       |
| -------------------------- | --------------------------------------------------------------------------------- |
| **Integration Name**       | A unique name for this integration (e.g., `gitlab-cloud-prod`)                    |
| **Description**            | A short description (e.g., “InfraKitchen GitLab Cloud integration for IaC repos”) |
| **Labels**                 | Tags such as `gitlab`, `repository`, or `infra`                                   |
| **GitLab Server URL**      | The URL to our own instance, or let it to its default for GitLab Cloud            |
| **GitLab Token**           | Paste the Access Token you generated                                              |

---

## 5️⃣ Test the Connection

Click **Test Connection** in the InfraKitchen setup form.
InfraKitchen will validate the GitLab token and access scope.

If the connection fails:

- Verify the **token** is correct and not expired.
- Confirm the scopes are matching what's described in step 3.

---

## 🔐 GitLab SSH (Alternative Connection Method)

SSH-based access is not recommended and not yet implemented.
