import { TemplatePage } from "./pages/Template";
import { TemplateActivityPage } from "./pages/TemplateActivity";
import { TemplateCreatePage } from "./pages/TemplateCreate";
import { TemplateEditPage } from "./pages/TemplateEdit";
import { TemplateImportPage } from "./pages/TemplateImport";
import { TemplatesPage } from "./pages/Templates";

export const templateRoutes = [
  {
    path: TemplatesPage.path,
    Component: TemplatesPage,
    requiredPermission: "api:template",
    permissionAction: "read",
  },
  {
    path: TemplateImportPage.path,
    Component: TemplateImportPage,
    requiredPermission: "api:template",
    permissionAction: "write",
  },
  {
    path: TemplateCreatePage.path,
    Component: TemplateCreatePage,
    requiredPermission: "api:template",
    permissionAction: "write",
  },
  {
    path: TemplatePage.path,
    Component: TemplatePage,
    requiredPermission: "api:template",
    permissionAction: "read",
  },
  {
    path: TemplateActivityPage.path,
    Component: TemplateActivityPage,
    requiredPermission: "api:template",
    permissionAction: "read",
  },
  {
    path: TemplateEditPage.path,
    Component: TemplateEditPage,
    requiredPermission: "api:template",
    permissionAction: "write",
  },
];
