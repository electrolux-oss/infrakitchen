import { AuditLogsPage } from "./pages/AuditLogs";

export const auditLogsRoutes = [
  {
    path: AuditLogsPage.path,
    Component: AuditLogsPage,
    requiredPermission: "api:audit_log",
    permissionAction: "read",
  },
];
