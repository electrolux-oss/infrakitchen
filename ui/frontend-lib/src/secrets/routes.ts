import { SecretPage } from "./pages/Secret";
import { SecretActivityPage } from "./pages/SecretActivity";
import { SecretCreatePage } from "./pages/SecretCreate";
import { SecretEditPage } from "./pages/SecretEdit";
import { SecretsPage } from "./pages/Secrets";

export const secretRoutes = [
  {
    path: SecretsPage.path,
    Component: SecretsPage,
  },
  {
    path: SecretPage.path,
    Component: SecretPage,
  },
  {
    path: SecretActivityPage.path,
    Component: SecretActivityPage,
  },
  {
    path: SecretCreatePage.path,
    Component: SecretCreatePage,
  },
  {
    path: SecretEditPage.path,
    Component: SecretEditPage,
  },
];
