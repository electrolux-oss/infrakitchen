import { yaml } from "@codemirror/lang-yaml";
import CodeMirror from "@uiw/react-codemirror";

import { FormControl, FormLabel, useColorScheme } from "../../ui";
import { cn } from "../../utils/cn";

export interface YamlEditorFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  helperText?: string;
  error?: string;
  readOnly?: boolean;
}

/** YAML text editor with syntax highlighting, styled like the other form fields. */
export const YamlEditorField = ({
  label,
  value,
  onChange,
  helperText,
  error,
  readOnly = false,
}: YamlEditorFieldProps) => {
  const { resolvedMode } = useColorScheme();

  return (
    <FormControl fullWidth margin="normal" error={!!error}>
      <FormLabel>{label}</FormLabel>
      <div className="rounded-surface border border-divider">
        <CodeMirror
          basicSetup={{ lineNumbers: true, foldGutter: true }}
          extensions={[yaml()]}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          editable={!readOnly}
          theme={resolvedMode}
          minHeight="240px"
          maxHeight="560px"
        />
      </div>
      {(error || helperText) && (
        <span
          className={cn(
            "mt-1 text-caption",
            error ? "text-error" : "text-fg-muted",
          )}
        >
          {error ?? helperText}
        </span>
      )}
    </FormControl>
  );
};
