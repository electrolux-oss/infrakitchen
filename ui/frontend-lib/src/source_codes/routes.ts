import { SourceCodePage } from "./pages/SourceCode";
import { SourceCodeActivityPage } from "./pages/SourceCodeActivity";
import { SourceCodeCreatePage } from "./pages/SourceCodeCreate";
import { SourceCodeEditPage } from "./pages/SourceCodeEdit";
import { SourceCodesPage } from "./pages/SourceCodes";

export const sourceCodeRoutes = [
  {
    path: SourceCodesPage.path,
    Component: SourceCodesPage,
  },
  {
    path: SourceCodePage.path,
    Component: SourceCodePage,
  },
  {
    path: SourceCodeActivityPage.path,
    Component: SourceCodeActivityPage,
  },
  {
    path: SourceCodeCreatePage.path,
    Component: SourceCodeCreatePage,
  },
  {
    path: SourceCodeEditPage.path,
    Component: SourceCodeEditPage,
  },
];
