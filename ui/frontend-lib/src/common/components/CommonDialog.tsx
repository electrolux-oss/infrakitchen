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
}

export const CommonDialog: React.FC<CommonDialogProps> = ({
  open,
  title,
  content,
  actions,
  onClose,
}) => {
  return (
    <Dialog open={open} onClose={onClose}>
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
      <DialogContent dividers sx={{ minWidth: 400 }}>
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
