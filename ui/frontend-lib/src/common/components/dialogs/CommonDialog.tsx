import React, { ReactNode } from "react";

import { CloseIcon } from "../../../icons/material";
import {
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "../../../ui";
import { cn } from "../../../utils/cn";

interface CommonDialogProps {
  open: boolean;
  title: ReactNode;
  content: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  fullWidth?: boolean;
  headerAction?: ReactNode;
  hasFooterActions?: boolean;
}

export const CommonDialog: React.FC<CommonDialogProps> = ({
  open,
  title,
  content,
  actions,
  onClose,
  maxWidth = "sm",
  fullWidth = true,
  headerAction,
  hasFooterActions = true,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
    >
      <DialogTitle className="flex items-center justify-between px-6 pt-5 pb-3 text-[1.0625rem] leading-[1.4] font-semibold">
        {title}
        <div className="flex items-center gap-1">
          {headerAction}
          <IconButton
            className={cn(
              "text-fg-muted hover:bg-hover",
              headerAction ? "ml-0" : "ml-2",
            )}
            onClick={onClose}
            size="small"
            aria-label="Close Dialog"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
      </DialogTitle>
      <DialogContent className="min-w-75 pt-1 sm:min-w-100">
        <div>{content}</div>
      </DialogContent>
      {hasFooterActions && (
        <DialogActions className="gap-2 px-6 pt-2 pb-5">
          <Button onClick={onClose}>Cancel</Button>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};
