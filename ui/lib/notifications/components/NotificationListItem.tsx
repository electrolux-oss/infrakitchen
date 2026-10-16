import {
  Box,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
} from "@mui/material";

import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { GqlUserNotification } from "../graphql";

import { UNREAD_DOT_SX } from "./notificationFormat";
import { ReadToggleButton } from "./ReadToggleButton";

interface NotificationListItemProps {
  notification: GqlUserNotification;
  onSelect: (notification: GqlUserNotification) => void;
  onToggleRead: (notification: GqlUserNotification) => void;
}

export const NotificationListItem = ({
  notification,
  onSelect,
  onToggleRead,
}: NotificationListItemProps) => {
  const isUnread = !notification.readAt;
  const headline = notification.title || notification.message;
  const showMessage =
    !!notification.title && notification.title !== notification.message;

  return (
    <ListItem
      disablePadding
      sx={{
        alignItems: "stretch",
        // The themed List is a flex column; without this rows shrink to fit its max height
        flexShrink: 0,
        width: "auto",
        mx: 1,
        my: 0.25,
        borderRadius: 1,
        overflow: "hidden",
        "&:hover": { bgcolor: "action.hover" },
        "& .MuiListItemButton-root:hover, & .MuiIconButton-root:hover": {
          bgcolor: "transparent",
        },
      }}
    >
      <ListItemButton
        onClick={() => onSelect(notification)}
        alignItems="flex-start"
        sx={{ gap: 1.5, py: 1, px: 2, minWidth: 0 }}
      >
        <Box
          aria-label={isUnread ? "Unread" : undefined}
          sx={{
            ...UNREAD_DOT_SX,
            mt: 0.75,
            visibility: isUnread ? "visible" : "hidden",
          }}
        />
        <Stack sx={{ minWidth: 0, flex: 1, gap: 0.25 }}>
          <Typography
            variant="body2"
            noWrap
            sx={{ fontWeight: isUnread ? 600 : 400 }}
          >
            {headline}
          </Typography>
          {showMessage && (
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                whiteSpace: "pre-line",
              }}
            >
              {notification.message}
            </Typography>
          )}
          <Stack
            direction="row"
            sx={{ gap: 1, alignItems: "center", color: "text.secondary" }}
          >
            {/* {notification.entityName && (
            <Typography variant="caption" noWrap sx={{ minWidth: 0 }}>
              {notification.entityName}
            </Typography>
          )} */}
            <RelativeTime
              date={notification.createdAt}
              variant="caption"
              sx={{ flexShrink: 0 }}
            />
          </Stack>
        </Stack>
      </ListItemButton>
      <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
        <ReadToggleButton
          isRead={!isUnread}
          onClick={() => onToggleRead(notification)}
        />
      </Box>
    </ListItem>
  );
};
