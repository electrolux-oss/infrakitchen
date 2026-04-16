import { BatchOperationPage } from "./pages/BatchOperation";
import { BatchOperationCreatePage } from "./pages/BatchOperationCreate";
import { BatchOperationsPage } from "./pages/BatchOperations";

export const batchOperationRoutes = [
  {
    path: BatchOperationsPage.path,
    Component: BatchOperationsPage,
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },
  {
    path: BatchOperationCreatePage.path,
    Component: BatchOperationCreatePage,
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },
  {
    path: BatchOperationPage.path,
    Component: BatchOperationPage,
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },
];
