import WorkerList from "./pages/Workers";

export const workerRoutes = [
  {
    path: "workers",
    Component: WorkerList,
    requiredPermission: "api:worker",
    permissionAction: "read",
  },
];
