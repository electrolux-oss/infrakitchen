import { forwardRef } from "react";

import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Typography, IconButton, Theme } from "@mui/material";
import { SnackbarKey, useSnackbar } from "notistack";

export type SnackbarVariant =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "default";

interface NotificationContentProps {
  id: SnackbarKey;
  message: string;
  variant: SnackbarVariant;
  title?: string;
}

const variantConfig = (theme: Theme, variant: SnackbarVariant) =>
  ({
    default: {
      color: theme.palette.grey[700],
    },
    success: {
      color: theme.palette.success.dark,
    },
    error: {
      color: theme.palette.error.dark,
    },
    warning: {
      color: theme.palette.warning.dark,
    },
    info: {
      color: theme.palette.info.dark,
    },
  })[variant];

const variantIcons = {
  default: InfoOutlinedIcon,
  success: CheckCircleOutlineIcon,
  error: ErrorOutlineIcon,
  warning: WarningAmberIcon,
  info: InfoOutlinedIcon,
};

export const NotificationContent = forwardRef<
  HTMLDivElement,
  NotificationContentProps
>(({ id, message, variant, title }, ref) => {
  const { closeSnackbar } = useSnackbar();
  const DynamicIcon = variantIcons[variant];
  const iconColor = "#fff";

  return (
    <Box
      ref={ref}
      sx={(theme) => {
        const config = variantConfig(theme, variant);
        return {
          p: 1.5,
          minWidth: { xs: "300px", sm: "400px" },
          backgroundColor: config.color,
          borderRadius: 1,
          boxShadow: 3,
          color: iconColor,
          display: "flex",
          alignItems: "flex-start",
        };
      }}
    >
      <DynamicIcon sx={{ mr: 2, mt: 0.5, flexShrink: 0, color: iconColor }} />

      <Box sx={{ flexGrow: 1, minWidth: 0, pr: 1 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
              {title}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                wordWrap: "break-word",
                color: "rgba(255, 255, 255, 0.9)",
              }}
            >
              {message}
            </Typography>
          </Box>

          <IconButton
            onClick={() => closeSnackbar(id)}
            size="small"
            sx={{
              ml: 1,
              color: iconColor,
              opacity: 0.8,
              "&:hover": {
                opacity: 1,
                backgroundColor: "rgba(255, 255, 255, 0.1)",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
});

NotificationContent.displayName = "NotificationContent";
