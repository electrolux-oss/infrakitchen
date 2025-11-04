import { IntegrationPage } from "./pages/Integration";
import { IntegrationActivityPage } from "./pages/IntegrationActivity";
import { IntegrationCreatePage } from "./pages/IntegrationCreate";
import { IntegrationEditPage } from "./pages/IntegrationEdit";
import { IntegrationsPage } from "./pages/Integrations";
import { ListIntegrationsPage } from "./pages/ListIntegrations";

export const integrationRoutes = [
  {
    path: IntegrationsPage.path,
    Component: IntegrationsPage,
  },
  {
    path: IntegrationCreatePage.path,
    Component: IntegrationCreatePage,
  },
  {
    path: IntegrationEditPage.path,
    Component: IntegrationEditPage,
  },
  {
    path: IntegrationActivityPage.path,
    Component: IntegrationActivityPage,
  },
  {
    path: ListIntegrationsPage.path,
    Component: ListIntegrationsPage,
  },
  {
    path: IntegrationPage.path,
    Component: IntegrationPage,
  },
];
