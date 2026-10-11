import { yaml } from "@codemirror/lang-yaml";
import {
  Box,
  FormControl,
  FormLabel,
  Typography,
  useColorScheme,
} from "@mui/material";
import CodeMirror from "@uiw/react-codemirror";

interface YamlEditorFieldProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  error?: string;
  helperText?: string;
  minHeight?: string;
}

export const YamlEditorField = ({
  label,
  value,
  onChange,
  readOnly = false,
  error,
  helperText,
  minHeight = "320px",
}: YamlEditorFieldProps) => {
  const { mode } = useColorScheme();

  return (
    <FormControl fullWidth margin="normal" error={!!error}>
      <FormLabel>{label}</FormLabel>
      <Box
        sx={{
          border: 1,
          borderColor: error ? "error.main" : "divider",
          borderRadius: "var(--template-surface-radius)",
          overflow: "hidden",
        }}
      >
        <CodeMirror
          basicSetup={{ lineNumbers: true, foldGutter: true }}
          extensions={[yaml()]}
          value={value}
          onChange={onChange}
          editable={!readOnly}
          readOnly={readOnly}
          minHeight={minHeight}
          theme={mode === "dark" ? "dark" : "light"}
        />
      </Box>
      {(error || helperText) && (
        <Typography
          variant="caption"
          color={error ? "error" : "text.secondary"}
          sx={{ mt: 0.5 }}
        >
          {error ?? helperText}
        </Typography>
      )}
    </FormControl>
  );
};
