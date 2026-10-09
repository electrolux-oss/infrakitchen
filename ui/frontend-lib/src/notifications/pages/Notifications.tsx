import { useCallback, useMemo, useRef } from "react";

import { useNavigate } from "react-router";

import DoneAllIcon from "@mui/icons-material/DoneAll";
import { Button } from "@mui/material";

import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../common/components/entity_table/EntityFetchTable";
import { getNotificationEntityLink } from "../../common/components/notifications/notificationLinks";
import { useConfig } from "../../common/context/ConfigContext";
import { useNotificationProvider } from "../../common/context/NotificationContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { userNotificationColumns } from "../components/userNotificationTableConfig";
import { GqlUserNotification, USER_NOTIFICATION_FIELD_MAP } from "../graphql";

export const NotificationsPage = () => {
  const { unreadCount, toggleNotificationRead, markAllNotificationsRead } =
    useNotificationProvider();
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();
  const tableRef = useRef<EntityFetchTableRef>(null);

  const handleToggleRead = useCallback(
    async (notification: GqlUserNotification) => {
      try {
        await toggleNotificationRead(notification);
        await tableRef.current?.refresh();
      } catch (error) {
        notifyError(error);
      }
    },
    [toggleNotificationRead],
  );

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await tableRef.current?.refresh();
    } catch (error) {
      notifyError(error);
    }
  };

  const handleRowClick = useCallback(
    (notification: GqlUserNotification, event?: MouseEvent) => {
      if (!notification.readAt) {
        void handleToggleRead(notification);
      }
      const link = getNotificationEntityLink(
        linkPrefix,
        notification.entityType,
        notification.entityId,
      );
      if (!link) return;
      if (event && (event.metaKey || event.ctrlKey || event.button === 1)) {
        window.open(link.to, "_blank");
        return;
      }
      navigate(link.to);
    },
    [handleToggleRead, linkPrefix, navigate],
  );

  const columns = useMemo(
    () => userNotificationColumns(handleToggleRead),
    [handleToggleRead],
  );

  return (
    <PageContainer
      title="Notifications"
      description="Notifications delivered to you in the last 30 days."
      actions={
        <Button
          size="small"
          startIcon={<DoneAllIcon />}
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          Mark all as read
        </Button>
      }
    >
      <EntityFetchTable
        ref={tableRef}
        title="Notifications"
        entityName="userNotification"
        columns={columns}
        entityFieldMap={USER_NOTIFICATION_FIELD_MAP}
        filterStorageKey="filter_user_notifications"
        defaultSort={{ field: "created_at", sort: "desc" }}
        onRowClick={handleRowClick}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

NotificationsPage.path = "/notifications";
