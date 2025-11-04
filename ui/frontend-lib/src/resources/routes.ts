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
  },
  {
    path: ResourcePage.path,
    Component: ResourcePage,
  },
  {
    path: ResourceActivityPage.path,
    Component: ResourceActivityPage,
  },
  {
    path: ResourceCreatePage.path,
    Component: ResourceCreatePage,
  },
  {
    path: ResourceEditPage.path,
    Component: ResourceEditPage,
  },
  {
    path: ResourceMetadataPage.path,
    Component: ResourceMetadataPage,
  },
];
