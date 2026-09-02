import React, { useState } from "react";

import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Popover,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";

interface SubscribeNotificationButtonProps {
  isSubscribed: boolean;
  isLoading?: boolean;
  onSubscribeClick: (inheritChildren: boolean) => void;
  onUnsubscribeClick: (inheritChildren: boolean) => void;
  entityName?: string;
  showIncludeChildren?: boolean;
}

export const SubscribeNotificationButton = ({
  isSubscribed,
  isLoading,
  onSubscribeClick,
  onUnsubscribeClick,
  entityName = "resource",
  showIncludeChildren = true,
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
            ? `Unsubscribe from ${entityName} notifications`
            : `Subscribe to ${entityName} notifications`
        }
      >
        <IconButton
          color={isSubscribed ? "error" : "primary"}
          onClick={handleButtonClick}
          disabled={isLoading}
          aria-label={isSubscribed ? "Unsubscribe" : "Subscribe"}
        >
          {isSubscribed ? (
            <NotificationsActiveIcon fontSize="small" />
          ) : (
            <NotificationsOffIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { borderRadius: 2, mt: 1 } } }}
      >
        <Stack sx={{ width: 320, p: 2, gap: 1.5 }}>
          <Stack direction="row" sx={{ gap: 1.5, alignItems: "center" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "50%",
                bgcolor: "action.hover",
                color: action === "subscribe" ? "primary.main" : "error.main",
              }}
            >
              {action === "subscribe" ? (
                <NotificationsOffIcon fontSize="small" />
              ) : (
                <NotificationsActiveIcon fontSize="small" />
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {action === "subscribe"
                  ? "Subscribe to notifications"
                  : "Unsubscribe from notifications"}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", display: "block" }}
              >
                {action === "subscribe"
                  ? `Get notified when this ${entityName} changes`
                  : `Stop receiving notifications for this ${entityName}`}
              </Typography>
            </Box>
          </Stack>
          <Divider />
          {showIncludeChildren ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Switch
                checked={inheritChildren}
                onChange={(e) => setInheritChildren(e.target.checked)}
                size="small"
              />
              <Typography variant="body2">Include child resources</Typography>
            </Box>
          ) : null}
          <Stack
            direction="row"
            sx={{
              justifyContent: "flex-end",
              gap: 1,
            }}
          >
            <Button onClick={handleClose} color="inherit">
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleConfirm}
              color={action === "subscribe" ? "primary" : "error"}
            >
              {action === "subscribe" ? "Subscribe" : "Unsubscribe"}
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
};
