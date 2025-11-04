import { StoragePage } from "./pages/Storage";
import { StorageActivityPage } from "./pages/StorageActivity";
import { StorageCreatePage } from "./pages/StorageCreate";
import { StorageEditPage } from "./pages/StorageEdit";
import { StoragesPage } from "./pages/Storages";

export const storageRoutes = [
  {
    path: StoragesPage.path,
    Component: StoragesPage,
  },
  {
    path: StoragePage.path,
    Component: StoragePage,
  },
  {
    path: StorageActivityPage.path,
    Component: StorageActivityPage,
  },
  {
    path: StorageCreatePage.path,
    Component: StorageCreatePage,
  },
  {
    path: StorageEditPage.path,
    Component: StorageEditPage,
  },
];
