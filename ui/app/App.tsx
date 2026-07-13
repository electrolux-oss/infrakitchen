import { useMemo } from "react";

import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router";

import {
  ConfigProvider,
  EventProvider,
  GradientCircularProgress,
  NotificationProvider,
  GlobalNotificationPopup,
  LocalStorageProvider,
  RouterSnackbarWrapper,
  PermissionProvider,
  usePermissionProvider,
  useFilteredProtectedRoutes,
} from "@electrolux-oss/infrakitchen";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";

import { AuthProvider, useAuth } from "./base/auth/AuthContext";
import { refreshAuth } from "./base/auth/refreshToken";
import {
  addRefreshAuthToDataProvider,
  ikDataProvider,
} from "./base/data/DataProvider";
import DashboardLayout from "./base/layout/DashboardLayout";
import SignInSide from "./sign-in-side/SignInSide";
import AppTheme from "./theme/AppTheme";

const unauthenticatedRouter = createBrowserRouter([
  { path: "/login", Component: SignInSide },
  { path: "*", element: <Navigate to="/login" replace /> },
]);

const PermissionFilteredRouter = () => {
  const { loading } = usePermissionProvider();
  const accessibleRoutes = useFilteredProtectedRoutes();

  const router = useMemo(
    () =>
      createBrowserRouter([
        {
          path: "/login",
          Component: SignInSide,
        },
        {
          element: <Outlet />,
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
      ]),
    [accessibleRoutes],
  );

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <GradientCircularProgress />
      </Box>
    );
  }

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

const AuthGate = ({ dataProvider }: { dataProvider: any }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <GradientCircularProgress />
      </Box>
    );
  }

  if (!user) {
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath && currentPath !== "/login") {
      localStorage.setItem("redirectPath", currentPath);
    }
    return (
      <AppTheme>
        <CssBaseline enableColorScheme>
          <RouterProvider router={unauthenticatedRouter} />
        </CssBaseline>
      </AppTheme>
    );
  }

  const storedRedirectPath = localStorage.getItem("redirectPath");
  if (storedRedirectPath) {
    localStorage.removeItem("redirectPath");
    window.history.replaceState(null, "", storedRedirectPath);
  }

  return (
    <LocalStorageProvider>
      <ConfigProvider initialIkApi={dataProvider}>
        <PermissionProvider>
          <EventProvider>
            <NotificationProvider>
              <InfrakitchenApp />
            </NotificationProvider>
          </EventProvider>
        </PermissionProvider>
      </ConfigProvider>
    </LocalStorageProvider>
  );
};

export const AppWrapper = () => {
  const baseDataProvider = ikDataProvider(`/api`);
  const dataProvider = addRefreshAuthToDataProvider(
    baseDataProvider,
    refreshAuth,
  );
  return (
    <AuthProvider>
      <AuthGate dataProvider={dataProvider} />
    </AuthProvider>
  );
};
