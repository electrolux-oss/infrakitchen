import React from "react";

import { BatchOperationPage } from "./pages/BatchOperation";
import { BatchOperationActivityPage } from "./pages/BatchOperationActivity";
import { BatchOperationCreatePage } from "./pages/BatchOperationCreate";
import { BatchOperationsPage } from "./pages/BatchOperations";

export const batchOperationRoutes = [
  {
    path: BatchOperationsPage.path,
    element: React.createElement(BatchOperationsPage),
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },
  {
    path: BatchOperationCreatePage.path,
    element: React.createElement(BatchOperationCreatePage),
    requiredPermission: "api:batch_operation",
    permissionAction: "write",
  },
  {
    path: BatchOperationPage.path,
    element: React.createElement(BatchOperationPage),
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },
  {
    path: BatchOperationActivityPage.path,
    element: React.createElement(BatchOperationActivityPage),
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },
];
