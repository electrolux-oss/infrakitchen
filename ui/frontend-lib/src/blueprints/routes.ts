import { BlueprintPage } from "./pages/Blueprint";
import { BlueprintCreatePage } from "./pages/BlueprintCreate";
import { BlueprintEditPage } from "./pages/BlueprintEdit";
import { BlueprintsPage } from "./pages/Blueprints";
import { BlueprintUsePage } from "./pages/BlueprintUse";

export const blueprintRoutes = [
  {
    path: BlueprintsPage.path,
    Component: BlueprintsPage,
    requiredPermission: "api:blueprint",
    permissionAction: "read",
  },
  {
    path: BlueprintCreatePage.path,
    Component: BlueprintCreatePage,
    requiredPermission: "api:blueprint",
    permissionAction: "write",
  },
  {
    path: BlueprintEditPage.path,
    Component: BlueprintEditPage,
    requiredPermission: "api:blueprint",
    permissionAction: "write",
  },
  {
    path: BlueprintUsePage.path,
    Component: BlueprintUsePage,
    requiredPermission: "api:blueprint",
    permissionAction: "write",
  },
  {
    path: BlueprintPage.path,
    Component: BlueprintPage,
    requiredPermission: "api:blueprint",
    permissionAction: "read",
  },
];
