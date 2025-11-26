import { createBrowserRouter, RouterProvider } from "react-router";

import {
  ConfigProvider,
  EventProvider,
  GettingStartedPage,
  administrationRoutes,
  auditLogsRoutes,
  authProviderRoutes,
  templateRoutes,
  integrationRoutes,
  resourceRoutes,
  storageRoutes,
  sourceCodeRoutes,
  sourceCodeVersionRoutes,
  taskRoutes,
  workspaceRoutes,
  workerRoutes,
  usersRoutes,
  roleRoutes,
  permissionRoutes,
  secretRoutes,
  NotificationProvider,
  GlobalNotificationPopup,
  LocalStorageProvider,
  RouterSnackbarWrapper,
} from "@electrolux-oss/infrakitchen";
import CssBaseline from "@mui/material/CssBaseline";

import { AuthProvider } from "./base/auth/AuthContext";
import { refreshAuth } from "./base/auth/refreshToken";
import {
  addRefreshAuthToDataProvider,
  ikDataProvider,
} from "./base/data/DataProvider";
import DashboardLayout from "./base/layout/DashboardLayout";
import ProtectedRoute from "./routes";
import SignInSide from "./sign-in-side/SignInSide";
import AppTheme from "./theme/AppTheme";

const router = createBrowserRouter([
  {
    // Public route for the login page
    path: "/login",
    Component: SignInSide,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <RouterSnackbarWrapper />,
        children: [
          {
            Component: DashboardLayout,
            children: [
              ...administrationRoutes,
              ...auditLogsRoutes,
              ...authProviderRoutes,
              ...templateRoutes,
              ...integrationRoutes,
              ...resourceRoutes,
              ...storageRoutes,
              ...secretRoutes,
              ...sourceCodeRoutes,
              ...sourceCodeVersionRoutes,
              ...taskRoutes,
              ...workspaceRoutes,
              ...usersRoutes,
              ...roleRoutes,
              ...permissionRoutes,
              ...workerRoutes,
              {
                path: GettingStartedPage.path,
                Component: GettingStartedPage,
              },
              {
                path: "*",
                Component: GettingStartedPage,
              },
            ],
          },
        ],
      },
    ],
  },
]);

export function InfrakitchenApp(props: { disableCustomTheme?: boolean }) {
  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme>
        <RouterProvider router={router} />
        <GlobalNotificationPopup />
      </CssBaseline>
    </AppTheme>
  );
}

export const AppWrapper = () => {
  const baseDataProvider = ikDataProvider(`/api`);
  const dataProvider = addRefreshAuthToDataProvider(
    baseDataProvider,
    refreshAuth,
  );
  return (
    <LocalStorageProvider>
      <ConfigProvider initialIkApi={dataProvider}>
        <AuthProvider>
          <EventProvider>
            <NotificationProvider>
              <InfrakitchenApp />
            </NotificationProvider>
          </EventProvider>
        </AuthProvider>
      </ConfigProvider>
    </LocalStorageProvider>
  );
};
