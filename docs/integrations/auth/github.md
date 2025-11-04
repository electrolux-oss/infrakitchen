# GitHub

## 🔧 Setting up Single Sign-On (SSO) with GitHub for InfraKitchen

GitHub SSO requires a GitHub App to be created. You can create a GitHub App in your organization or user account.
[Check out the official documentation](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps)
Put the following settings in the GitHub App:

- **Homepage URL**: The URL of your InfraKitchen instance, e.g. `http://localhost:7777`.
- **Authorization callback URL**: The URL to authorize the GitHub App, e.g. `http://localhost:7777/api/auth/github/callback`.

---

## ⚙️ InfraKitchen Configuration

To configure InfraKitchen to use the GitHub App, you need to provide the following parameters in auth provider settings:

1. **Client ID**: The Client ID of the GitHub App.
2. **Client Secret**: The Client Secret of the GitHub App.
3. **Redirect URL**: The URL to authorize the GitHub App. e.g. `http://localhost:7777/api/auth/github/callback`
4. **Filter by domain**: If you want to restrict access to users with a specific email domain, you can set this parameter. For example, if you want to allow only users with `@example.com` email addresses, set this parameter to `example.com`.
