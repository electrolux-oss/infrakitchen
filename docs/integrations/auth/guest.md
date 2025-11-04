# Guest

The InfraKitchen Guest Authentication Provider is a non-production, development-focused identity solution. It allows users to gain access to the InfraKitchen UI and API with a predefined, shared identity without requiring external credentials (like GitHub or Microsoft).

## 🔓 Purpose of Guest Authentication

The Guest Provider is intended for local development, testing, and demonstration environments where rapid, simplified access is needed.

For your Infrakitchen project, the Guest Provider can be configured to map to different identity roles, which, when combined with the Permission System (RBAC), simulates different access levels without needing real user accounts.

In production environments allows to setting up proper authentication providers (like GitHub, Microsoft, Backstage, etc.) to ensure secure and individualized access control.

### ⚠️ **Security Warning**

The Guest Provider is inherently **insecure** for production use. It grants all users who select it a single, shared identity. Its primary purpose is to quickly test permission policies and UI behavior during development.

---

## 👥 Use Cases for InfraKitchen Roles (in Development)

By configuring the Guest Provider's default identity to be a member of specific Catalog **Groups**, you can effectively simulate your `default`, `infra`, and `super` roles.

1. Simulating the `default` User Role (Base Access)
   This is the standard use case for the Guest Provider.

2. Simulating the `infra` Role (Platform Engineers)
   This simulates a user with permissions for infrastructure operations.
3. Simulating the `super` Role (Admin/SRE)
   This simulates the highest level of access for administrative tasks.
