import { SourceCodeVersionPage } from "./pages/SourceCodeVersion";
import { SourceCodeVersionActivityPage } from "./pages/SourceCodeVersionActivity";
import { SourceCodeVersionConfigPage } from "./pages/SourceCodeVersionConfig";
import { SourceCodeVersionCreatePage } from "./pages/SourceCodeVersionCreate";
import { SourceCodeVersionEditPage } from "./pages/SourceCodeVersionEdit";
import { SourceCodeVersionsPage } from "./pages/SourceCodeVersions";

export const sourceCodeVersionRoutes = [
  {
    path: SourceCodeVersionsPage.path,
    Component: SourceCodeVersionsPage,
  },
  {
    path: SourceCodeVersionPage.path,
    Component: SourceCodeVersionPage,
  },
  {
    path: SourceCodeVersionCreatePage.path,
    Component: SourceCodeVersionCreatePage,
  },
  {
    path: SourceCodeVersionActivityPage.path,
    Component: SourceCodeVersionActivityPage,
  },
  {
    path: SourceCodeVersionEditPage.path,
    Component: SourceCodeVersionEditPage,
  },
  {
    path: SourceCodeVersionConfigPage.path,
    Component: SourceCodeVersionConfigPage,
  },
];
