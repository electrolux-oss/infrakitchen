# Google

## 🔧 Setting up Single Sign-On (SSO) with Google for InfraKitchen

Google SSO requires an OAuth 2.0 Client ID to be created in Google Cloud.
[Check out the official documentation](https://developers.google.com/identity/protocols/oauth2)
Put the following settings in the Google Cloud OAuth client:

- **Application type**: Web application.
- **Authorized JavaScript origins**: The URL of your InfraKitchen instance, e.g. `http://localhost:7777`.
- **Authorized redirect URIs**: The URL to authorize the Google OAuth client, e.g. `http://localhost:7777/api/auth/google/callback`.

Google must return a refresh token for InfraKitchen session refresh. The InfraKitchen Google login flow already requests offline access and consent during login.

---

## ⚙️ InfraKitchen Configuration

To configure InfraKitchen to use the Google OAuth client, you need to provide the following parameters in auth provider settings:

1. **Client ID**: The Client ID of the Google OAuth client.
2. **Client Secret**: The Client Secret of the Google OAuth client.
3. **Redirect URL**: The URL to authorize the Google OAuth client. e.g. `http://localhost:7777/api/auth/google/callback`
4. **Filter by domain**: If you want to restrict access to users with a specific email domain, you can set this parameter. For example, if you want to allow only users with `@example.com` email addresses, set this parameter to `example.com`.
