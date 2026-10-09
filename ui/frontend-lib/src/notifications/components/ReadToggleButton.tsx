import { MouseEvent } from "react";

import DoneIcon from "@mui/icons-material/Done";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import { IconButton, Tooltip } from "@mui/material";

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
        size="small"
        aria-label={label}
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          onClick();
        }}
        sx={{
          // Shown only on row hover; && outranks the theme's ListItem button opacity
          ".MuiListItem-root &&, .MuiDataGrid-row &&": { opacity: 0 },
          ".MuiListItem-root:hover &&, .MuiDataGrid-row:hover &&, &&:focus-visible":
            { opacity: 1 },
          "@media (hover: none)": {
            ".MuiListItem-root &&, .MuiDataGrid-row &&": { opacity: 1 },
          },
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
