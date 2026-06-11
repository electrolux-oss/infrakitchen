import React, { useState } from "react";

import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import {
  Button,
  Checkbox,
  FormControlLabel,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

interface SubscribeNotificationButtonProps {
  isSubscribed: boolean;
  isLoading?: boolean;
  onSubscribeClick: (inheritChildren: boolean) => void;
  onUnsubscribeClick: (inheritChildren: boolean) => void;
}

export const SubscribeNotificationButton = ({
  isSubscribed,
  isLoading,
  onSubscribeClick,
  onUnsubscribeClick,
}: SubscribeNotificationButtonProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [inheritChildren, setInheritChildren] = useState(false);
  const [action, setAction] = useState<"subscribe" | "unsubscribe">(
    "subscribe",
  );

  const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isSubscribed) {
      setAction("unsubscribe");
      setAnchorEl(event.currentTarget);
    } else {
      setAction("subscribe");
      setAnchorEl(event.currentTarget);
    }
  };

  const handleConfirm = () => {
    setAnchorEl(null);
    if (action === "subscribe") {
      onSubscribeClick(inheritChildren);
      return;
    }
    onUnsubscribeClick(inheritChildren);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip
        title={
          isSubscribed
            ? "Unsubscribe from resource notifications"
            : "Subscribe to resource notifications"
        }
      >
        <Button
          variant="outlined"
          startIcon={<NotificationsActiveOutlinedIcon fontSize="small" />}
          color={isSubscribed ? "error" : "primary"}
          onClick={handleButtonClick}
          disabled={isLoading}
        >
          {isSubscribed ? "Unsubscribe" : "Subscribe"}
        </Button>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Stack sx={{ p: 2, gap: 1.5, minWidth: 240 }}>
          <Typography variant="subtitle2">
            {action === "subscribe"
              ? "Subscribe to notifications"
              : "Unsubscribe from notifications"}
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={inheritChildren}
                onChange={(e) => setInheritChildren(e.target.checked)}
                size="small"
              />
            }
            label="Include child resources"
          />
          <Stack direction="row" justifyContent="flex-end" gap={1}>
            <Button size="small" onClick={handleClose}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={handleConfirm}>
              {action === "subscribe" ? "Subscribe" : "Unsubscribe"}
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
};
