import React, { lazy } from "react";

import { RouteObject } from "react-router";

import { usePermissionProvider } from "./common";
import { GettingStartedPage, NotFoundPage } from "./getting_started";

type LazyRouteDefinition = RouteObject & {
  requiredPermission?: string;
  permissionAction?: string;
};

const lz = <T extends Record<string, React.ComponentType<any>>>(
  factory: () => Promise<T>,
  name: keyof T,
) =>
  lazy(() =>
    factory().then((m) => ({ default: m[name] as React.ComponentType<any> })),
  );

const allRoutes: LazyRouteDefinition[] = [
  // ── Administration ──────────────────────────────────────────────────────────
  {
    path: "/admin",
    Component: lz(
      () => import("./administration/pages/AdminPage"),
      "AdminPage",
    ),
    requiredPermission: "api:admin",
    permissionAction: "admin",
  },

  // ── Audit Logs ───────────────────────────────────────────────────────────────
  {
    path: "/audit_logs",
    Component: lz(
      () => import("./audit_logs/pages/AuditLogs"),
      "AuditLogsPage",
    ),
    requiredPermission: "api:audit_log",
    permissionAction: "read",
  },

  // ── Auth Providers ───────────────────────────────────────────────────────────
  {
    path: "/auth_providers",
    Component: lz(
      () => import("./auth_providers/pages/AuthProviders"),
      "AuthProvidersPage",
    ),
    requiredPermission: "api:auth_provider",
    permissionAction: "read",
  },
  {
    path: "/auth_providers/create",
    Component: lz(
      () => import("./auth_providers/pages/AuthProviderCreate"),
      "AuthProviderCreatePage",
    ),
    requiredPermission: "api:auth_provider",
    permissionAction: "write",
  },
  {
    path: "/auth_providers/:auth_provider_id/edit",
    Component: lz(
      () => import("./auth_providers/pages/AuthProviderEdit"),
      "AuthProviderEditPage",
    ),
    requiredPermission: "api:auth_provider",
    permissionAction: "write",
  },
  {
    path: "/auth_providers/:auth_provider_id/:tab?",
    Component: lz(
      () => import("./auth_providers/pages/AuthProvider"),
      "AuthProviderPage",
    ),
    requiredPermission: "api:auth_provider",
    permissionAction: "read",
  },

  // ── Blueprints ───────────────────────────────────────────────────────────────
  {
    path: "/blueprints",
    Component: lz(
      () => import("./blueprints/pages/Blueprints"),
      "BlueprintsPage",
    ),
    requiredPermission: "api:blueprint",
    permissionAction: "read",
  },
  {
    path: "/blueprints/create",
    Component: lz(
      () => import("./blueprints/pages/BlueprintCreate"),
      "BlueprintCreatePage",
    ),
    requiredPermission: "api:blueprint",
    permissionAction: "write",
  },
  {
    path: "/blueprints/:blueprint_id/edit",
    Component: lz(
      () => import("./blueprints/pages/BlueprintEdit"),
      "BlueprintEditPage",
    ),
    requiredPermission: "api:blueprint",
    permissionAction: "write",
  },
  {
    path: "/blueprints/:blueprint_id/use",
    Component: lz(
      () => import("./blueprints/pages/BlueprintUse"),
      "BlueprintUsePage",
    ),
    requiredPermission: "api:blueprint",
    permissionAction: "write",
  },
  {
    path: "/blueprints/:blueprint_id/:tab?",
    Component: lz(
      () => import("./blueprints/pages/Blueprint"),
      "BlueprintPage",
    ),
    requiredPermission: "api:blueprint",
    permissionAction: "read",
  },

  // ── Batch Operations ─────────────────────────────────────────────────────────
  {
    path: "/batch_operations",
    Component: lz(
      () => import("./batch_operations/pages/BatchOperations"),
      "BatchOperationsPage",
    ),
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },
  {
    path: "/batch_operations/create",
    Component: lz(
      () => import("./batch_operations/pages/BatchOperationCreate"),
      "BatchOperationCreatePage",
    ),
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },
  {
    path: "/batch_operations/:batch_operation_id/:tab?",
    Component: lz(
      () => import("./batch_operations/pages/BatchOperation"),
      "BatchOperationPage",
    ),
    requiredPermission: "api:batch_operation",
    permissionAction: "read",
  },

  // ── Executors ────────────────────────────────────────────────────────────────
  {
    path: "/executors",
    Component: lz(() => import("./executors/pages/Executors"), "ExecutorsPage"),
    requiredPermission: "api:executor",
    permissionAction: "read",
  },
  {
    path: "/executors/create",
    Component: lz(
      () => import("./executors/pages/ExecutorCreate"),
      "ExecutorCreatePage",
    ),
    requiredPermission: "api:executor",
    permissionAction: "read",
  },
  {
    path: "/executors/:executor_id/edit",
    Component: lz(
      () => import("./executors/pages/ExecutorEdit"),
      "ExecutorEditPage",
    ),
    requiredPermission: "api:executor",
    permissionAction: "read",
  },
  {
    path: "/executors/:executor_id/:tab?",
    Component: lz(() => import("./executors/pages/Executor"), "ExecutorPage"),
    requiredPermission: "api:executor",
    permissionAction: "read",
  },

  // ── Integrations ─────────────────────────────────────────────────────────────
  {
    path: "/integrations",
    Component: lz(
      () => import("./integrations/pages/Integrations"),
      "IntegrationsPage",
    ),
    requiredPermission: "api:integration",
    permissionAction: "read",
  },
  {
    path: "/integrations/:provider/setup",
    Component: lz(
      () => import("./integrations/pages/IntegrationCreate"),
      "IntegrationCreatePage",
    ),
    requiredPermission: "api:integration",
    permissionAction: "write",
  },
  {
    path: "/integrations/:integration_id/edit",
    Component: lz(
      () => import("./integrations/pages/IntegrationEdit"),
      "IntegrationEditPage",
    ),
    requiredPermission: "api:integration",
    permissionAction: "write",
  },
  {
    path: "/integrations/:provider/:integration_id/:tab?",
    Component: lz(
      () => import("./integrations/pages/Integration"),
      "IntegrationPage",
    ),
    requiredPermission: "api:integration",
    permissionAction: "read",
  },

  // ── Permissions ───────────────────────────────────────────────────────────────
  {
    path: "/permissions/:permission_id",
    Component: lz(
      () => import("./permissions/pages/Permission"),
      "PermissionPage",
    ),
    requiredPermission: "api:permission",
    permissionAction: "read",
  },

  // ── Resources ─────────────────────────────────────────────────────────────────
  {
    path: "/resources",
    Component: lz(() => import("./resources/pages/Resources"), "ResourcesPage"),
    requiredPermission: "api:resource",
    permissionAction: "read",
  },
  {
    path: "/resources/create",
    Component: lz(
      () => import("./resources/pages/ResourceCreate"),
      "ResourceCreatePage",
    ),
    requiredPermission: "api:resource",
    permissionAction: "read",
  },
  {
    path: "/resources/:resource_id/edit",
    Component: lz(
      () => import("./resources/pages/ResourceEdit"),
      "ResourceEditPage",
    ),
    requiredPermission: "api:resource",
    permissionAction: "read",
  },
  {
    path: "/resources/:resource_id/metadata",
    Component: lz(
      () => import("./resources/components/ResourceMetadata"),
      "ResourceMetadataPage",
    ),
    requiredPermission: "api:resource",
    permissionAction: "read",
  },
  {
    path: "/resources/:resource_id/:tab?",
    Component: lz(() => import("./resources/pages/Resource"), "ResourcePage"),
    requiredPermission: "api:resource",
    permissionAction: "read",
  },

  // ── Roles ─────────────────────────────────────────────────────────────────────
  {
    path: "/roles/create",
    Component: lz(() => import("./roles/pages/RoleCreate"), "RoleCreatePage"),
    requiredPermission: "api:permission",
    permissionAction: "write",
  },
  {
    path: "/roles",
    Component: lz(() => import("./roles/pages/Roles"), "RolesPage"),
    requiredPermission: "api:permission",
    permissionAction: "read",
  },
  {
    path: "/roles/:role_id",
    Component: lz(() => import("./roles/pages/Role"), "RolePage"),
    requiredPermission: "api:permission",
    permissionAction: "read",
  },

  // ── Secrets ───────────────────────────────────────────────────────────────────
  {
    path: "/secrets",
    Component: lz(() => import("./secrets/pages/Secrets"), "SecretsPage"),
    requiredPermission: "api:secret",
    permissionAction: "read",
  },
  {
    path: "/secrets/create",
    Component: lz(
      () => import("./secrets/pages/SecretCreate"),
      "SecretCreatePage",
    ),
    requiredPermission: "api:secret",
    permissionAction: "write",
  },
  {
    path: "/secrets/:secret_id/edit",
    Component: lz(() => import("./secrets/pages/SecretEdit"), "SecretEditPage"),
    requiredPermission: "api:secret",
    permissionAction: "write",
  },
  {
    path: "/secrets/:secret_id/:tab?",
    Component: lz(() => import("./secrets/pages/Secret"), "SecretPage"),
    requiredPermission: "api:secret",
    permissionAction: "read",
  },

  // ── Source Codes ──────────────────────────────────────────────────────────────
  {
    path: "/source_codes",
    Component: lz(
      () => import("./source_codes/pages/SourceCodes"),
      "SourceCodesPage",
    ),
    requiredPermission: "api:source_code",
    permissionAction: "read",
  },
  {
    path: "/source_codes/create",
    Component: lz(
      () => import("./source_codes/pages/SourceCodeCreate"),
      "SourceCodeCreatePage",
    ),
    requiredPermission: "api:source_code",
    permissionAction: "write",
  },
  {
    path: "/source_codes/:source_code_id/edit",
    Component: lz(
      () => import("./source_codes/pages/SourceCodeEdit"),
      "SourceCodeEditPage",
    ),
    requiredPermission: "api:source_code",
    permissionAction: "write",
  },
  {
    path: "/source_codes/:source_code_id/:tab?",
    Component: lz(
      () => import("./source_codes/pages/SourceCode"),
      "SourceCodePage",
    ),
    requiredPermission: "api:source_code",
    permissionAction: "read",
  },

  // ── Storages ──────────────────────────────────────────────────────────────────
  {
    path: "/storages",
    Component: lz(() => import("./storages/pages/Storages"), "StoragesPage"),
    requiredPermission: "api:storage",
    permissionAction: "read",
  },
  {
    path: "/storages/create",
    Component: lz(
      () => import("./storages/pages/StorageCreate"),
      "StorageCreatePage",
    ),
    requiredPermission: "api:storage",
    permissionAction: "write",
  },
  {
    path: "/storages/:storage_id/edit",
    Component: lz(
      () => import("./storages/pages/StorageEdit"),
      "StorageEditPage",
    ),
    requiredPermission: "api:storage",
    permissionAction: "write",
  },
  {
    path: "/storages/:storage_id/:tab?",
    Component: lz(() => import("./storages/pages/Storage"), "StoragePage"),
    requiredPermission: "api:storage",
    permissionAction: "read",
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  {
    path: "/tasks",
    Component: lz(() => import("./tasks/pages/Tasks"), "TasksPage"),
    requiredPermission: "api:task",
    permissionAction: "read",
  },

  // ── Templates ─────────────────────────────────────────────────────────────────
  {
    path: "/templates",
    Component: lz(() => import("./templates/pages/Templates"), "TemplatesPage"),
    requiredPermission: "api:template",
    permissionAction: "read",
  },
  {
    path: "/templates/import",
    Component: lz(
      () => import("./templates/pages/TemplateImport"),
      "TemplateImportPage",
    ),
    requiredPermission: "api:template",
    permissionAction: "write",
  },
  {
    path: "/templates/create",
    Component: lz(
      () => import("./templates/pages/TemplateCreate"),
      "TemplateCreatePage",
    ),
    requiredPermission: "api:template",
    permissionAction: "write",
  },
  {
    path: "/templates/:template_id/edit",
    Component: lz(
      () => import("./templates/pages/TemplateEdit"),
      "TemplateEditPage",
    ),
    requiredPermission: "api:template",
    permissionAction: "write",
  },
  {
    path: "/templates/:template_id/:tab?",
    Component: lz(() => import("./templates/pages/Template"), "TemplatePage"),
    requiredPermission: "api:template",
    permissionAction: "read",
  },

  // ── Users ─────────────────────────────────────────────────────────────────────
  {
    path: "/users",
    Component: lz(() => import("./users/pages/Users"), "UsersPage"),
    requiredPermission: "api:user",
    permissionAction: "read",
  },
  {
    path: "/users/create",
    Component: lz(() => import("./users/pages/UserCreate"), "UserCreatePage"),
    requiredPermission: "api:user",
    permissionAction: "write",
  },
  {
    path: "/users/:user_id/edit",
    Component: lz(() => import("./users/pages/UserEdit"), "UserEditPage"),
    requiredPermission: "api:user",
    permissionAction: "write",
  },
  {
    path: "/users/:user_id/:tab?",
    Component: lz(() => import("./users/pages/User"), "UserPage"),
    requiredPermission: "api:user",
    permissionAction: "read",
  },

  // ── Workers ───────────────────────────────────────────────────────────────────
  {
    path: "workers",
    Component: lazy(() => import("./workers/pages/Workers")),
    requiredPermission: "api:worker",
    permissionAction: "read",
  },

  // ── Workflows ─────────────────────────────────────────────────────────────────
  {
    path: "/workflows",
    Component: lz(() => import("./workflows/pages/Workflows"), "WorkflowsPage"),
    requiredPermission: "api:workflow",
    permissionAction: "read",
  },
  {
    path: "/workflows/:workflow_id/:tab?",
    Component: lz(() => import("./workflows/pages/Workflow"), "WorkflowPage"),
    requiredPermission: "api:workflow",
    permissionAction: "read",
  },

  // ── Workspaces ────────────────────────────────────────────────────────────────
  {
    path: "/workspaces",
    Component: lz(
      () => import("./workspaces/pages/Workspaces"),
      "WorkspacesPage",
    ),
    requiredPermission: "api:workspace",
    permissionAction: "read",
  },
  {
    path: "/workspaces/create",
    Component: lz(
      () => import("./workspaces/pages/WorkspaceCreate"),
      "WorkspaceCreatePage",
    ),
    requiredPermission: "api:workspace",
    permissionAction: "write",
  },
  {
    path: "/workspaces/:workspace_id/edit",
    Component: lz(
      () => import("./workspaces/pages/WorkspaceEdit"),
      "WorkspaceEditPage",
    ),
    requiredPermission: "api:workspace",
    permissionAction: "write",
  },
  {
    path: "/workspaces/:workspace_id/:tab?",
    Component: lz(
      () => import("./workspaces/pages/Workspace"),
      "WorkspacePage",
    ),
    requiredPermission: "api:workspace",
    permissionAction: "read",
  },
];

export const useFilteredProtectedRoutes = (): RouteObject[] => {
  const { permissions } = usePermissionProvider();

  const checkActionPermission = (resource: string, action: string): boolean => {
    if (permissions["*"] === "admin") {
      return true;
    }

    const userPermission = permissions[resource];

    if (!userPermission) {
      return false;
    }

    if (action === "read") {
      return true;
    }

    if (action === "write") {
      return userPermission === "write" || userPermission === "admin";
    }

    if (action === "admin") {
      return userPermission === "admin";
    }

    return false;
  };

  const accessibleRoutes = allRoutes.filter((route) => {
    if (route.requiredPermission && route.permissionAction) {
      return checkActionPermission(
        route.requiredPermission,
        route.permissionAction,
      );
    }
    return false;
  });

  accessibleRoutes.push(
    { path: "/", Component: GettingStartedPage },
    { path: GettingStartedPage.path, Component: GettingStartedPage },
    { path: "*", Component: NotFoundPage },
  );

  return accessibleRoutes;
};
