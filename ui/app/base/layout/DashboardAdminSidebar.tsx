import { matchPath, useLocation } from "react-router";

import { PermissionWrapper } from "@electrolux-oss/infrakitchen";
import DnsIcon from "@mui/icons-material/Dns";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";

import DashboardSidebarPageItem from "./DashboardSidebarPageItem";

export const DashboardAdminSidebar = () => {
  const { pathname } = useLocation();
  return (
    <PermissionWrapper requiredPermission="*" permissionAction="admin">
      <DashboardSidebarPageItem
        id="auth_providers"
        title="Auth Providers"
        icon={<VerifiedUserIcon />}
        href="/auth_providers"
        selected={!!matchPath("/auth_providers/*", pathname)}
        permissionKey="auth_provider"
      />
      <DashboardSidebarPageItem
        id="worker_templates"
        title="Worker Templates"
        icon={<DnsIcon />}
        href="/worker_templates"
        selected={!!matchPath("/worker_templates/*", pathname)}
        permissionKey="worker_template"
      />
      <DashboardSidebarPageItem
        id="admin"
        title="Settings"
        icon={<MiscellaneousServicesIcon />}
        href="/admin"
        selected={!!matchPath("/admin/*", pathname)}
        permissionKey="*"
      />
    </PermissionWrapper>
  );
};
