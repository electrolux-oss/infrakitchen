import { matchPath, useLocation } from "react-router";

import DashboardSidebarPageItem from "./DashboardSidebarPageItem";

import { PermissionWrapper } from "@/index";
import {
  HeroCog6ToothIcon,
  HeroFingerPrintIcon,
  HeroRocketLaunchIcon,
} from "@/index";

export const DashboardAdminSidebar = () => {
  const { pathname } = useLocation();
  return (
    <PermissionWrapper requiredPermission="*" permissionAction="admin">
      <DashboardSidebarPageItem
        id="auth_providers"
        title="Auth Providers"
        icon={<HeroFingerPrintIcon />}
        href="/auth_providers"
        selected={!!matchPath("/auth_providers/*", pathname)}
        permissionKey="auth_provider"
      />
      <DashboardSidebarPageItem
        id="worker_templates"
        title="Worker Templates"
        icon={<HeroRocketLaunchIcon />}
        href="/worker_templates"
        selected={!!matchPath("/worker_templates/*", pathname)}
        permissionKey="worker_template"
      />
      <DashboardSidebarPageItem
        id="admin"
        title="Settings"
        icon={<HeroCog6ToothIcon />}
        href="/admin"
        selected={!!matchPath("/admin/*", pathname)}
        permissionKey="*"
      />
    </PermissionWrapper>
  );
};
