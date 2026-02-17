import { BatchOperationPage } from "./pages/BatchOperation";
import { BatchOperationActivityPage } from "./pages/BatchOperationActivity";
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
    permissionAction: "write",
  },
  {
    path: BatchOperationPage.path,
    Component: BatchOperationPage,
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },
  {
    path: BatchOperationActivityPage.path,
    Component: BatchOperationActivityPage,
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },
];
