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
  },
  {
    path: TemplateImportPage.path,
    Component: TemplateImportPage,
  },
  {
    path: TemplateCreatePage.path,
    Component: TemplateCreatePage,
  },
  {
    path: TemplatePage.path,
    Component: TemplatePage,
  },
  {
    path: TemplateActivityPage.path,
    Component: TemplateActivityPage,
  },
  {
    path: TemplateEditPage.path,
    Component: TemplateEditPage,
  },
];
