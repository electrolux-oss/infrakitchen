import React from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Slide,
} from "@mui/material";
import type { TransitionProps } from "@mui/material/transitions";

interface DialogSliderProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement<any, any>;
  },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="left" ref={ref} {...props} />;
});

export const DialogSlider = (props: DialogSliderProps) => {
  const { open, onClose, children, title } = props;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      slots={{
        transition: Transition,
      }}
      slotProps={{
        backdrop: {
          invisible: false,
          sx: {
            backdropFilter: "blur(1px)",
            backgroundColor: "rgba(0, 0, 0, 0.3)",
          },
        },
        paper: {
          sx: {
            position: "absolute",
            right: 0,
            margin: 0,
            height: "100%",
            borderRadius: 0,
            width: { xs: "100%", sm: 900, md: 1100 },
            boxShadow: "-4px 0 20px rgba(0, 0, 0, 0.15)",
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      {title && (
        <DialogTitle
          sx={{
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography component="h2" variant="h5">
            {title}
          </Typography>
        </DialogTitle>
      )}
      {children && <DialogContent dividers={false}>{children}</DialogContent>}
      <DialogActions
        sx={{
          borderTop: 1,
          borderColor: "divider",
          px: 3,
          py: 2,
          gap: 1,
        }}
      >
        <Button
          onClick={onClose}
          color="primary"
          variant="outlined"
          sx={{
            minWidth: 100,
            textTransform: "none",
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
