import React, { ReactNode } from "react";

import CloseIcon from "@mui/icons-material/Close";
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
  actions: ReactNode;
  onClose: () => void;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  fullWidth?: boolean;
}

export const CommonDialog: React.FC<CommonDialogProps> = ({
  open,
  title,
  content,
  actions,
  onClose,
  maxWidth = "sm",
  fullWidth = true,
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
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close Dialog"
          sx={{ ml: 1 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ minWidth: { xs: 300, sm: 400 } }}>
        <Typography component="span">{content}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="outlined">
          Cancel
        </Button>
        {actions}
      </DialogActions>
    </Dialog>
  );
};
