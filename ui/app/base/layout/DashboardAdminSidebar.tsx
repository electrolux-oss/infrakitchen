import { matchPath, useLocation } from "react-router";

import { PermissionWrapper } from "@electrolux-oss/infrakitchen";
import BallotIcon from "@mui/icons-material/Ballot";
import MiscellaneousServicesIcon from "@mui/icons-material/MiscellaneousServices";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";

import DashboardSidebarDividerItem from "./DashboardSidebarDividerItem";
import DashboardSidebarHeaderItem from "./DashboardSidebarHeaderItem";
import DashboardSidebarPageItem from "./DashboardSidebarPageItem";

export const DashboardAdminSidebar = () => {
  const { pathname } = useLocation();
  return (
    <PermissionWrapper requiredPermission="*" permissionAction="admin">
      <DashboardSidebarDividerItem />
      <DashboardSidebarHeaderItem>Administration</DashboardSidebarHeaderItem>

      <DashboardSidebarPageItem
        id="batch_operations"
        title="Batch Operations"
        icon={<BallotIcon />}
        href="/batch_operations"
        selected={!!matchPath("/batch_operations/*", pathname)}
        permissionKey="batch_operation"
      />

      <DashboardSidebarPageItem
        id="auth_providers"
        title="Auth Providers"
        icon={<VerifiedUserIcon />}
        href="/auth_providers"
        selected={!!matchPath("/auth_providers/*", pathname)}
        permissionKey="auth_provider"
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
