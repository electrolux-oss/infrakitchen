import { FC, forwardRef, useState } from "react";

import {
  alpha,
  Box,
  FormControl,
  FormHelperText,
  Typography,
  useTheme,
} from "@mui/material";
import MDEditor from "@uiw/react-md-editor";

const MAX_BYTES = 65_535;

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  label?: string;
  error?: boolean;
  helperText?: string;
  minHeight?: number;
  disabled?: boolean;
}

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
};

/**
 * Markdown editor with split editor/preview, integrated with MUI theme
 * and react-hook-form's Controller.
 */
const MarkdownEditorInner: FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onBlur,
  name,
  label,
  error,
  helperText,
  minHeight = 200,
  disabled = false,
}) => {
  const theme = useTheme();
  const colorMode = theme.palette.mode === "dark" ? "dark" : "light";
  const bytes = new Blob([value || ""]).size;
  const overLimit = bytes > MAX_BYTES;
  const [focused, setFocused] = useState(false);

  const hasError = error || overLimit;
  const labelColor = hasError
    ? "error.main"
    : focused
      ? "primary.main"
      : "text.secondary";
  const borderColor = hasError
    ? "error.main"
    : focused
      ? "primary.main"
      : "divider";

  return (
    <FormControl fullWidth sx={{ my: 2 }} error={hasError} disabled={disabled}>
      {label && (
        <Typography
          component="label"
          variant="body2"
          sx={{
            display: "block",
            color: labelColor,
            fontSize: `calc(${theme.typography.body1.fontSize} * 0.75)`,
            fontWeight: theme.typography.body1.fontWeight,
            fontFamily: theme.typography.body1.fontFamily,
            lineHeight: 1.4375,
            mb: 0.5,
            transition: theme.transitions.create("color", {
              duration: theme.transitions.duration.shorter,
            }),
          }}
        >
          {label}
        </Typography>
      )}
      <Box
        data-color-mode={colorMode}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setFocused(false);
            onBlur?.();
          }
        }}
        sx={{
          borderRadius: 1,
          border: 1,
          borderColor,
          overflow: "hidden",
          boxShadow:
            focused && !hasError
              ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.25)}`
              : "none",
          transition: theme.transitions.create(["border-color", "box-shadow"], {
            duration: theme.transitions.duration.shorter,
          }),
          "& .w-md-editor": {
            boxShadow: "none",
            borderRadius: 0,
            backgroundColor: "transparent",
          },
          "& .w-md-editor-toolbar": {
            borderRadius: 0,
            backgroundColor: "transparent",
          },
        }}
      >
        <MDEditor
          value={value || ""}
          onChange={(v) => onChange(v || "")}
          height={minHeight}
          visibleDragbar={false}
          preview="live"
          textareaProps={{
            name,
            disabled,
          }}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          mt: 0.5,
        }}
      >
        {helperText ? (
          <FormHelperText sx={{ m: 0 }}>{helperText}</FormHelperText>
        ) : (
          <span />
        )}
        <Typography
          variant="caption"
          color={overLimit ? "error" : "text.secondary"}
        >
          {formatBytes(bytes)} / {formatBytes(MAX_BYTES)}
        </Typography>
      </Box>
    </FormControl>
  );
};

export const MarkdownEditor = forwardRef<HTMLDivElement, MarkdownEditorProps>(
  (props, _ref) => <MarkdownEditorInner {...props} />,
);

MarkdownEditor.displayName = "MarkdownEditor";
