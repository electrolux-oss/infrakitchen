import { createBrowserRouter, RouterProvider } from "react-router";

import {
  ConfigProvider,
  EventProvider,
  NotificationProvider,
  GlobalNotificationPopup,
  LocalStorageProvider,
  RouterSnackbarWrapper,
  PermissionProvider,
  useFilteredProtectedRoutes,
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

const PermissionFilteredRouter = () => {
  const accessibleRoutes = useFilteredProtectedRoutes();

  const router = createBrowserRouter([
    {
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
              children: accessibleRoutes,
            },
          ],
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
};

export function InfrakitchenApp(props: { disableCustomTheme?: boolean }) {
  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme>
        <PermissionFilteredRouter />
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
          <PermissionProvider>
            <EventProvider>
              <NotificationProvider>
                <InfrakitchenApp />
              </NotificationProvider>
            </EventProvider>
          </PermissionProvider>
        </AuthProvider>
      </ConfigProvider>
    </LocalStorageProvider>
  );
};
