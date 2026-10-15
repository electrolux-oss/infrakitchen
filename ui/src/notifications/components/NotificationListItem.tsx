import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { ListItem, ListItemButton } from "../../ui";
import { cn } from "../../utils/cn";
import { GqlUserNotification } from "../graphql";

import { UNREAD_DOT_CLASSES } from "./notificationFormat";
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
      // The themed List is a flex column; without this rows shrink to fit its max height
      className="mx-2 my-0.5 w-auto shrink-0 items-stretch overflow-hidden rounded-[8px] hover:bg-hover [&_.d-btn:hover]:bg-transparent [&_[role=button]:hover]:bg-transparent"
      disablePadding
    >
      <ListItemButton
        className="min-w-0 gap-3 px-4 py-2"
        onClick={() => onSelect(notification)}
        alignItems="flex-start"
      >
        <div
          aria-label={isUnread ? "Unread" : undefined}
          className={cn(
            UNREAD_DOT_CLASSES,
            "mt-1.5",
            isUnread ? "visible" : "invisible",
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p
            className={cn(
              "m-0 truncate text-body2",
              isUnread ? "font-semibold" : "font-normal",
            )}
          >
            {headline}
          </p>
          {showMessage && (
            <span className="line-clamp-2 overflow-hidden text-caption whitespace-pre-line text-fg-muted [-webkit-box-orient:vertical]">
              {notification.message}
            </span>
          )}
          <div className="flex flex-row items-center gap-2 text-fg-muted">
            <RelativeTime
              date={notification.createdAt}
              className="shrink-0 text-caption"
            />
          </div>
        </div>
      </ListItemButton>
      <div className="flex items-center pr-2">
        <ReadToggleButton
          isRead={!isUnread}
          onClick={() => onToggleRead(notification)}
        />
      </div>
    </ListItem>
  );
};
