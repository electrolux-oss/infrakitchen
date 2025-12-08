import { AdminPage } from "./pages/AdminPage";

export const administrationRoutes = [
  {
    path: AdminPage.path,
    Component: AdminPage,
    requiredPermission: "api:admin",
    permissionAction: "admin",
  },
];
