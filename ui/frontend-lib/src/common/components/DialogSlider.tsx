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
      TransitionComponent={Transition}
      maxWidth="md"
      PaperProps={{
        sx: {
          position: "absolute",
          right: 0,
          margin: 0,
          height: "100%",
          borderRadius: 0,
          width: { xs: "100%", sm: 900, md: 1100 },
        },
      }}
      slotProps={{
        backdrop: {
          invisible: false,
          sx: { backdropFilter: "blur(1px)" },
        },
      }}
    >
      {title && (
        <DialogTitle>
          <Typography component="h2" variant="h5">
            {title}
          </Typography>
        </DialogTitle>
      )}
      {children && <DialogContent dividers>{children}</DialogContent>}
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
