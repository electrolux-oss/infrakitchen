# Authentication Providers

This section provides an overview of the various **Authentication Providers** integrated into our project, enabling users and services to securely access resources. These providers allow you to leverage existing identity systems, often referred to as **Single Sign-On (SSO)**, to manage authentication.

---

### Available Integrations

We support a variety of authentication methods tailored to different use cases:

**Third-Party SSO Integrations:** For external users and developers, we support popular identity platforms:

- **[GitHub](github.md)**:
  Allows authentication using existing GitHub accounts.

- **[Microsoft](microsoft.md)**:
  Enables login via Microsoft accounts (e.g., Azure AD, personal accounts).

- **[Backstage](backstage.md)**:
  Integration for users coming from a Backstage environment, ensuring seamless identity flow.

- **[Service Account](service-account.md)**:
  Used for **non-interactive authentication**, typically for automated tasks, services, or machine-to-machine communication, using long-lived credentials.

- **[Guest](guest.md)**:
  Provides a simple, **unauthenticated** way to access public or restricted-read resources without requiring a formal login.

---

### Enabling SSO or Disabling Authentication Methods

To enable Single Sign-On (SSO) or disable authentication entirely, you need to configure the auth provider in InfraKitchen UI. This typically involves specifying the desired authentication provider and its parameters.
