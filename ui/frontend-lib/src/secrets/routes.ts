import { SecretPage } from "./pages/Secret";
import { SecretCreatePage } from "./pages/SecretCreate";
import { SecretEditPage } from "./pages/SecretEdit";
import { SecretsPage } from "./pages/Secrets";

export const secretRoutes = [
  {
    path: SecretsPage.path,
    Component: SecretsPage,
    requiredPermission: "api:secret",
    permissionAction: "read",
  },
  {
    path: SecretPage.path,
    Component: SecretPage,
    requiredPermission: "api:secret",
    permissionAction: "read",
  },
  {
    path: SecretCreatePage.path,
    Component: SecretCreatePage,
    requiredPermission: "api:secret",
    permissionAction: "write",
  },
  {
    path: SecretEditPage.path,
    Component: SecretEditPage,
    requiredPermission: "api:secret",
    permissionAction: "write",
  },
];
