import { useMemo } from "react";

import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router";

import { AuthProvider, useAuth } from "./app/base/auth/AuthContext";
import { refreshAuth } from "./app/base/auth/refreshToken";
import {
  addRefreshAuthToDataProvider,
  ikDataProvider,
} from "./app/base/data/DataProvider";
import DashboardLayout from "./app/base/layout/DashboardLayout";
import SignInSide from "./app/sign-in-side/SignInSide";

import {
  ColorSchemeProvider,
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
} from "@/index";

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
      <div className="flex h-[100vh] items-center justify-center">
        <GradientCircularProgress />
      </div>
    );
  }

  return <RouterProvider router={router} />;
};

export function InfrakitchenApp() {
  return (
    <>
      <PermissionFilteredRouter />
      <GlobalNotificationPopup />
    </>
  );
}

const AuthGate = ({ dataProvider }: { dataProvider: any }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-[100vh] items-center justify-center">
        <GradientCircularProgress />
      </div>
    );
  }

  if (!user) {
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath && currentPath !== "/login") {
      localStorage.setItem("redirectPath", currentPath);
    }
    return <RouterProvider router={unauthenticatedRouter} />;
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
    <ColorSchemeProvider>
      <AuthProvider>
        <AuthGate dataProvider={dataProvider} />
      </AuthProvider>
    </ColorSchemeProvider>
  );
};
