import { AuthProviderPage } from "./pages/AuthProvider";
import { AuthProviderActivityPage } from "./pages/AuthProviderActivity";
import { AuthProviderCreatePage } from "./pages/AuthProviderCreate";
import { AuthProviderEditPage } from "./pages/AuthProviderEdit";
import { AuthProvidersPage } from "./pages/AuthProviders";

export const authProviderRoutes = [
  {
    path: AuthProvidersPage.path,
    Component: AuthProvidersPage,
    requiredPermission: "api:auth_provider",
    permissionAction: "read",
  },
  {
    path: AuthProviderPage.path,
    Component: AuthProviderPage,
    requiredPermission: "api:auth_provider",
    permissionAction: "read",
  },
  {
    path: AuthProviderCreatePage.path,
    Component: AuthProviderCreatePage,
    requiredPermission: "api:auth_provider",
    permissionAction: "write",
  },
  {
    path: AuthProviderEditPage.path,
    Component: AuthProviderEditPage,
    requiredPermission: "api:auth_provider",
    permissionAction: "write",
  },
  {
    path: AuthProviderActivityPage.path,
    Component: AuthProviderActivityPage,
    requiredPermission: "api:auth_provider",
    permissionAction: "read",
  },
];
