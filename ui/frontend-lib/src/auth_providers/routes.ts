import { AuthProviderPage } from "./pages/AuthProvider";
import { AuthProviderActivityPage } from "./pages/AuthProviderActivity";
import { AuthProviderCreatePage } from "./pages/AuthProviderCreate";
import { AuthProviderEditPage } from "./pages/AuthProviderEdit";
import { AuthProvidersPage } from "./pages/AuthProviders";

export const authProviderRoutes = [
  {
    path: AuthProvidersPage.path,
    Component: AuthProvidersPage,
  },
  {
    path: AuthProviderPage.path,
    Component: AuthProviderPage,
  },
  {
    path: AuthProviderCreatePage.path,
    Component: AuthProviderCreatePage,
  },
  {
    path: AuthProviderEditPage.path,
    Component: AuthProviderEditPage,
  },
  {
    path: AuthProviderActivityPage.path,
    Component: AuthProviderActivityPage,
  },
];
