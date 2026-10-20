import React, { useState } from "react";

import { useNavigate } from "react-router";

import { useConfig } from "../../../common/context/ConfigContext";
import { HeroBellAlertIcon, HeroBellSlashIcon } from "../../../icons";
import { HeroAdjustmentsHorizontalIcon } from "../../../icons";
import {
  Divider,
  Switch,
  Button,
  IconButton,
  Tooltip,
  Popover,
} from "../../../ui";
import { cn } from "../../../utils/cn";

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
  const { linkPrefix, currentUser } = useConfig();
  const navigate = useNavigate();
  const preferencesPath = currentUser?.id
    ? `${linkPrefix}users/${currentUser.id}/notifications`
    : undefined;
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
          onClick={handleButtonClick}
          disabled={isLoading}
          aria-label={isSubscribed ? "Unsubscribe" : "Subscribe"}
        >
          {isSubscribed ? (
            <HeroBellAlertIcon fontSize="small" />
          ) : (
            <HeroBellSlashIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        className="mt-2 rounded-[16px]"
      >
        <div className="flex w-100 flex-col gap-3 p-4">
          <div className="flex flex-row items-center gap-3">
            <div
              className={cn(
                action === "subscribe" ? "text-primary" : "text-error",
                "flex h-9 w-9 items-center justify-center rounded-full bg-hover",
              )}
            >
              {action === "subscribe" ? (
                <HeroBellSlashIcon fontSize="small" />
              ) : (
                <HeroBellAlertIcon fontSize="small" />
              )}
            </div>
            <div className="min-w-0">
              <h6 className="m-0 text-subtitle2 font-semibold text-grey-500">
                {action === "subscribe"
                  ? "Subscribe to notifications"
                  : "Unsubscribe from notifications"}
              </h6>
              <span className="block text-caption text-fg-muted">
                {action === "subscribe"
                  ? `Get notified when this ${entityName} changes`
                  : `Stop receiving notifications for this ${entityName}`}
              </span>
            </div>
          </div>
          <Divider />
          {showIncludeChildren ? (
            <div className="flex items-center gap-2">
              <Switch
                checked={inheritChildren}
                onChange={(e) => setInheritChildren(e.target.checked)}
              />
              <p className="m-0 text-body2">Include child resources</p>
            </div>
          ) : null}
          <div className="flex flex-row items-center justify-between gap-2">
            {preferencesPath ? (
              <Button
                size="small"
                startIcon={<HeroAdjustmentsHorizontalIcon />}
                onClick={() => {
                  handleClose();
                  navigate(preferencesPath);
                }}
              >
                Preferences
              </Button>
            ) : (
              <div />
            )}
            <div className="flex flex-row gap-2">
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
            </div>
          </div>
        </div>
      </Popover>
    </>
  );
};
