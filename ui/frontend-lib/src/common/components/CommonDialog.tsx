import React, { ReactNode } from "react";

import CloseIcon from "@mui/icons-material/Close";
import { Box } from "@mui/material";
import {
  Dialog,
  DialogTitle,
  IconButton,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";

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
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 3,
          pt: 2.5,
          pb: 1.5,
          fontSize: "1.0625rem",
          fontWeight: 600,
          lineHeight: 1.4,
        }}
      >
        {title}
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {headerAction}
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Close Dialog"
            sx={{
              ml: headerAction ? 0 : 1,
              color: "text.secondary",
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ minWidth: { xs: 300, sm: 400 }, pt: 0.5 }}>
        <Box>{content}</Box>
      </DialogContent>
      {hasFooterActions && (
        <DialogActions sx={{ px: 3, pt: 1, pb: 2.5, gap: 1 }}>
          <Button onClick={onClose}>Cancel</Button>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};
