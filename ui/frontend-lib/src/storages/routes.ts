import { StoragePage } from "./pages/Storage";
import { StorageCreatePage } from "./pages/StorageCreate";
import { StoragesPage } from "./pages/Storages";

export const storageRoutes = [
  {
    path: StoragesPage.path,
    Component: StoragesPage,
    requiredPermission: "api:storage",
    permissionAction: "read",
  },
  {
    path: StoragePage.path,
    Component: StoragePage,
    requiredPermission: "api:storage",
    permissionAction: "read",
  },
  {
    path: StorageCreatePage.path,
    Component: StorageCreatePage,
    requiredPermission: "api:storage",
    permissionAction: "write",
  },
];
