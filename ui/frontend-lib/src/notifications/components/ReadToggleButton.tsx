import { MouseEvent } from "react";

import { DoneIcon, MarkEmailUnreadOutlinedIcon } from "../../icons/material";
import { IconButton, Tooltip } from "../../ui";

interface ReadToggleButtonProps {
  isRead: boolean;
  onClick: () => void;
}

export const ReadToggleButton = ({
  isRead,
  onClick,
}: ReadToggleButtonProps) => {
  const label = isRead ? "Mark as unread" : "Mark as read";
  return (
    <Tooltip title={label}>
      <IconButton
        className="focus-visible:opacity-100 [li_&]:opacity-0 [@media(hover:none)]:[li_&]:opacity-100 [li:hover_&]:opacity-100 [tr_&]:opacity-0 [@media(hover:none)]:[tr_&]:opacity-100 [tr:hover_&]:opacity-100"
        size="small"
        aria-label={label}
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          onClick();
        }}
      >
        {isRead ? (
          <MarkEmailUnreadOutlinedIcon fontSize="small" />
        ) : (
          <DoneIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
};
