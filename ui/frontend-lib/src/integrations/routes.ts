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
    requiredPermission: "api:integration",
    permissionAction: "read",
  },
  {
    path: IntegrationCreatePage.path,
    Component: IntegrationCreatePage,
    requiredPermission: "api:integration",
    permissionAction: "write",
  },
  {
    path: IntegrationEditPage.path,
    Component: IntegrationEditPage,
    requiredPermission: "api:integration",
    permissionAction: "write",
  },
  {
    path: IntegrationActivityPage.path,
    Component: IntegrationActivityPage,
    requiredPermission: "api:integration",
    permissionAction: "read",
  },
  {
    path: ListIntegrationsPage.path,
    Component: ListIntegrationsPage,
    requiredPermission: "api:integration",
    permissionAction: "read",
  },
  {
    path: IntegrationPage.path,
    Component: IntegrationPage,
    requiredPermission: "api:integration",
    permissionAction: "read",
  },
];
