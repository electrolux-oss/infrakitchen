import { MouseEvent, useState } from "react";

import { useNavigate } from "react-router";

import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  Popover,
  Stack,
  Typography,
} from "@mui/material";

import { getNotificationEntityLink } from "../../common/components/notifications/notificationLinks";
import { useConfig } from "../../common/context/ConfigContext";
import { useNotificationProvider } from "../../common/context/NotificationContext";
import { notifyError } from "../../common/hooks/useNotification";
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
        sx={(theme) => ({
          border: "none",
          backgroundColor: "transparent",
          "&:hover": { backgroundColor: "transparent" },
          ...theme.applyStyles("dark", {
            border: "none",
            backgroundColor: "transparent",
            "&:hover": { backgroundColor: "transparent" },
          }),
        })}
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
        slotProps={{
          paper: {
            variant: "outlined",
            sx: { width: 380, mt: 1, borderRadius: 2, overflow: "hidden" },
          },
        }}
      >
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1.5,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Notifications
          </Typography>
          <Button
            size="small"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
        </Stack>
        <Divider />
        {recentNotifications.length === 0 ? (
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", px: 2, py: 3 }}
          >
            You have no notifications.
          </Typography>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 400, overflow: "auto" }}>
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
        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
          <Button size="small" onClick={handleViewAll}>
            View all notifications
          </Button>
        </Box>
      </Popover>
    </>
  );
};
