import { MouseEvent, useState } from "react";

import { useNavigate } from "react-router";

import { getNotificationEntityLink } from "../../common/components/notifications/notificationLinks";
import { useConfig } from "../../common/context/ConfigContext";
import { useNotificationProvider } from "../../common/context/NotificationContext";
import { notifyError } from "../../common/hooks/useNotification";
import { NotificationsNoneOutlinedIcon } from "../../icons/material";
import { Divider, Button, IconButton, Popover, List, Badge } from "../../ui";
import { GqlUserNotification } from "../graphql";

import { NotificationListItem } from "./NotificationListItem";

export const NotificationBell = () => {
  const {
    unreadCount,
    recentNotifications,
    refreshNotifications,
    markNotificationsRead,
    markAllNotificationsRead,
    toggleNotificationRead,
  } = useNotificationProvider();
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const open = Boolean(anchorEl);

  const notificationsPath = `${linkPrefix}notifications`;

  const handleIconClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (open) {
      setAnchorEl(null);
      return;
    }
    setAnchorEl(event.currentTarget);
    void refreshNotifications();
  };

  const handleClose = () => setAnchorEl(null);

  const handleSelect = async (notification: GqlUserNotification) => {
    handleClose();
    const link = getNotificationEntityLink(
      linkPrefix,
      notification.entityType,
      notification.entityId,
      notification.eventType,
    );
    navigate(link?.to ?? notificationsPath);
    if (!notification.readAt) {
      try {
        await markNotificationsRead([notification.id]);
      } catch (error) {
        notifyError(error);
      }
    }
  };

  const handleToggleRead = async (notification: GqlUserNotification) => {
    try {
      await toggleNotificationRead(notification);
    } catch (error) {
      notifyError(error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
    } catch (error) {
      notifyError(error);
    }
  };

  const handleViewAll = () => {
    handleClose();
    navigate(notificationsPath);
  };

  return (
    <>
      <IconButton
        className="border-0 bg-transparent hover:bg-transparent"
        size="small"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-haspopup="true"
        aria-controls={open ? "notifications-panel" : undefined}
        aria-expanded={open ? "true" : undefined}
        onClick={handleIconClick}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsNoneOutlinedIcon />
        </Badge>
      </IconButton>
      <Popover
        id="notifications-panel"
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        className="mt-2 w-[380px] overflow-hidden rounded-[16px] border border-divider shadow-none"
      >
        <div className="flex flex-row items-center justify-between px-4 py-3">
          <h6 className="m-0 text-subtitle2 font-semibold text-grey-500">
            Notifications
          </h6>
          <Button
            size="small"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        </div>
        <Divider />
        {recentNotifications.length === 0 ? (
          <p className="m-0 px-4 py-6 text-body2 text-fg-muted">
            You have no notifications.
          </p>
        ) : (
          <List className="max-h-100 overflow-auto" dense disablePadding>
            {recentNotifications.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
                onSelect={handleSelect}
                onToggleRead={handleToggleRead}
              />
            ))}
          </List>
        )}
        <Divider />
        <div className="flex justify-center py-2">
          <Button size="small" onClick={handleViewAll}>
            View all notifications
          </Button>
        </div>
      </Popover>
    </>
  );
};
