import React, { ReactNode } from "react";

import CloseIcon from "@mui/icons-material/Close";
import { Box } from "@mui/material";
import {
  Dialog,
  DialogTitle,
  IconButton,
  DialogContent,
  DialogActions,
  Typography,
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
        }}
      >
        {title}
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {headerAction}
          <IconButton
            onClick={onClose}
            size="small"
            aria-label="Close Dialog"
            sx={{ ml: headerAction ? 0 : 1 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ minWidth: { xs: 300, sm: 400 } }}>
        <Typography component="span">{content}</Typography>
      </DialogContent>
      {hasFooterActions && (
        <DialogActions>
          <Button onClick={onClose} color="primary" variant="outlined">
            Cancel
          </Button>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};
