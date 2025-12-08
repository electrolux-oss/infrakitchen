import { ResourceMetadataPage } from "./components/ResourceMetadata";
import { ResourcePage } from "./pages/Resource";
import { ResourceActivityPage } from "./pages/ResourceActivity";
import { ResourceCreatePage } from "./pages/ResourceCreate";
import { ResourceEditPage } from "./pages/ResourceEdit";
import { ResourcesPage } from "./pages/Resources";

export const resourceRoutes = [
  {
    path: ResourcesPage.path,
    Component: ResourcesPage,
    requiredPermission: "api:resource",
    permissionAction: "read",
  },
  {
    path: ResourcePage.path,
    Component: ResourcePage,
    requiredPermission: "api:resource",
    permissionAction: "read",
  },
  {
    path: ResourceActivityPage.path,
    Component: ResourceActivityPage,
    requiredPermission: "api:resource",
    permissionAction: "read",
  },
  {
    path: ResourceCreatePage.path,
    Component: ResourceCreatePage,
    requiredPermission: "api:resource",
    permissionAction: "read",
  },
  {
    path: ResourceEditPage.path,
    Component: ResourceEditPage,
    requiredPermission: "api:resource",
    permissionAction: "read",
  },
  {
    path: ResourceMetadataPage.path,
    Component: ResourceMetadataPage,
    requiredPermission: "api:resource",
    permissionAction: "read",
  },
];
