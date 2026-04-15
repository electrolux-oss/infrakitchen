import { IntegrationPage } from "./pages/Integration";
import { IntegrationCreatePage } from "./pages/IntegrationCreate";
import { IntegrationEditPage } from "./pages/IntegrationEdit";
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
    path: IntegrationEditPage.path,
    Component: IntegrationEditPage,
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
