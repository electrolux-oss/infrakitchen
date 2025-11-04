# Microsoft

## 🔧 Microsoft Single Sign-On Setup for InfraKitchen

### Microsoft Entra ID Application Registration

To enable Microsoft Single Sign-On (SSO), you must register a new application in the Azure Portal. This application will represent InfraKitchen to Microsoft Entra ID, allowing it to request authentication tokens.

1. **Log in to the Azure Portal:** Navigate to the Azure Portal and search for **Microsoft Entra ID**.
2. **Create a New App Registration:**
    * Go to **App registrations** > **+ New registration**.
    * Enter a **Name** for your application (e.g., `InfraKitchen SSO`).
    * For **Supported account types**, select the option that best fits your organization (e.g., *Accounts in this organizational directory only - Single tenant*).
3. **Configure Redirect URI:**
    * Under the **Redirect URI** section, select **Web** as the platform.
    * Enter the **Authorization callback URL** for your InfraKitchen instance.
        * **Example:** `http://localhost:7777/api/auth/microsoft/callback`
4. **Register the Application:** Click **Register**.
5. **Gather Application Details:** From the application's **Overview** page, copy and save the following values, which you will use in the InfraKitchen configuration:
    * **Application (Client) ID**
    * **Directory (Tenant) ID**
6. **Create a Client Secret:**
    * Navigate to **Certificates & secrets** in the left menu.
    * Click **+ New client secret**.
    * Add a **Description** and choose an expiration period. Click **Add**.
    * **Crucially, copy the **Value** of the generated secret immediately.** This value is your **Client Secret** and will be hidden once you navigate away from the page.

---

## ⚙️ InfraKitchen Configuration

To configure InfraKitchen to use the Microsoft Entra ID App Registration, you need to provide the following parameters in the auth provider settings, using the values you gathered from the Azure Portal:

1. **Client ID**: The **Application (Client) ID** from the App Registration Overview.
2. **Client Secret**: The **Value** of the Client Secret you generated and copied (not the Secret ID).
3. **Tenant ID**: The **Directory (Tenant) ID** from the App Registration Overview.
    * *Note: Providing the Tenant ID is a common way to scope the login to a specific Entra ID tenant (Single Tenant setup).*
4. **Redirect URL**: The URL to authorize the Microsoft App, which must match the **Redirect URI** you configured in the Azure Portal. e.g., `http://localhost:7777/api/auth/microsoft/callback`
5. **Filter by domain**: If you want to restrict access to users with a specific email domain, you can set this parameter. For example, if you want to allow only users with `@infrakitchen.io` email addresses, set this parameter to `infrakitchen.io`.
