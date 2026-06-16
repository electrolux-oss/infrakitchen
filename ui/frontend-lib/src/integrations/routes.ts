import { IntegrationPage } from "./pages/Integration";
import { IntegrationCreatePage } from "./pages/IntegrationCreate";
import { IntegrationsPage } from "./pages/Integrations";

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
    path: IntegrationPage.path,
    Component: IntegrationPage,
    requiredPermission: "api:integration",
    permissionAction: "read",
  },
];
