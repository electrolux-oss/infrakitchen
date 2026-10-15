import { FC, forwardRef, useState } from "react";

import MDEditor from "@uiw/react-md-editor/nohighlight";

import { FormControl, FormHelperText, useColorScheme } from "../../../ui";
import { cn } from "../../../utils/cn";

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
 * Markdown editor with split editor/preview, styled like the form fields
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
  const { resolvedMode: colorMode } = useColorScheme();
  const bytes = new Blob([value || ""]).size;
  const overLimit = bytes > MAX_BYTES;
  const [focused, setFocused] = useState(false);

  const hasError = error || overLimit;
  return (
    <FormControl
      className="my-4"
      fullWidth
      error={hasError}
      disabled={disabled}
    >
      {label && (
        <label
          className={cn(
            "mb-1 block text-[0.75rem] leading-[1.4375] transition-colors duration-200",
            hasError
              ? "text-error"
              : focused
                ? "text-primary"
                : "text-fg-muted",
          )}
        >
          {label}
        </label>
      )}
      <div
        data-color-mode={colorMode}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setFocused(false);
            onBlur?.();
          }
        }}
        className={cn(
          "overflow-hidden rounded-surface border transition-[border-color,box-shadow] duration-200",
          "[&_.w-md-editor]:rounded-none [&_.w-md-editor]:bg-transparent [&_.w-md-editor]:shadow-none [&_.w-md-editor-toolbar]:rounded-none [&_.w-md-editor-toolbar]:bg-transparent",
          hasError
            ? "border-error"
            : focused
              ? "border-primary shadow-[0_0_0_3px] shadow-primary/25"
              : "border-divider",
        )}
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
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        {helperText ? (
          <FormHelperText className="m-0">{helperText}</FormHelperText>
        ) : (
          <span />
        )}
        <span
          className={cn(
            "text-caption",
            overLimit ? "text-error" : "text-fg-muted",
          )}
        >
          {formatBytes(bytes)} / {formatBytes(MAX_BYTES)}
        </span>
      </div>
    </FormControl>
  );
};

export const MarkdownEditor = forwardRef<HTMLDivElement, MarkdownEditorProps>(
  (props, _ref) => <MarkdownEditorInner {...props} />,
);

MarkdownEditor.displayName = "MarkdownEditor";
