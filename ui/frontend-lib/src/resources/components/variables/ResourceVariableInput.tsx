import React, { useCallback, useEffect, useState } from "react";

import { json } from "@codemirror/lang-json";
import { lintGutter } from "@codemirror/lint";
import {
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  MenuItem,
  Switch,
  TextField,
  useColorScheme,
} from "@mui/material";
import CodeMirror from "@uiw/react-codemirror";

import { ResourceVariableSchema } from "../../types";

import { buildHintLabels } from "./validationUtils";

interface JsonEditorProps {
  field: {
    value: any;
    name: string;
    onChange: (value: any) => void;
  };
  fieldState: {
    error?: {
      message?: string;
    };
  };
}

const JsonEditor: React.FC<JsonEditorProps> = ({ field, fieldState }) => {
  const { mode } = useColorScheme();
  const [jsonStr, setJsonStr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback(
    (updatedSrc: string) => {
      try {
        field.onChange(JSON.parse(updatedSrc));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [field],
  );

  useEffect(() => {
    try {
      setJsonStr(JSON.stringify(field.value ?? {}, null, 2));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [field.value, field.name]);

  const hasError = !!error || !!fieldState.error;

  return (
    <FormControl fullWidth margin="normal" error={hasError}>
      <FormLabel>Value</FormLabel>
      <CodeMirror
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
        }}
        extensions={[json(), lintGutter()]}
        value={jsonStr}
        onChange={handleChange}
        theme={mode === "dark" ? "dark" : "light"}
      />
    </FormControl>
  );
};

export const ResourceVariableInput = (props: {
  variable: ResourceVariableSchema;
  field: any;
  fieldState: any;
  isDisabled?: boolean;
}) => {
  const { variable, field, fieldState, isDisabled = false } = props;
  const hintLabels = buildHintLabels(variable);

  const hintChips =
    hintLabels.length > 0 ? (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
        {hintLabels.map((label) => (
          <Chip
            key={label}
            size="small"
            color="info"
            variant="outlined"
            label={label}
          />
        ))}
      </Box>
    ) : null;
  const control = (() => {
    switch (variable.type) {
      case "string":
        if (variable.options.length > 0) {
          return (
            <TextField
              {...field}
              select
              required={variable.required}
              value={field.value ?? ""}
              label="Value"
              variant="outlined"
              fullWidth
              margin="normal"
              disabled={isDisabled}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              onChange={(e) => field.onChange(e.target.value)}
            >
              {variable.options.map((option: string) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          );
        }

        return (
          <TextField
            {...field}
            required={variable.required}
            value={field.value ?? ""}
            label="Value"
            variant="outlined"
            fullWidth
            margin="normal"
            disabled={isDisabled}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
          />
        );

      case "number":
        return (
          <TextField
            {...field}
            required={variable.required}
            value={
              field.value === null || field.value === undefined
                ? ""
                : Number(field.value)
            }
            label="Value"
            disabled={isDisabled}
            onChange={(e) => {
              const val = e.target.value;
              field.onChange(val === "" ? undefined : Number(val));
            }}
            type="number"
            variant="outlined"
            fullWidth
            margin="normal"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
          />
        );

      case "boolean":
        return (
          <FormControl
            fullWidth
            margin="normal"
            disabled={isDisabled}
            error={!!fieldState.error?.message}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              }
              label={field.value ? "On" : "Off"}
            />
            <FormHelperText>{fieldState.error?.message}</FormHelperText>
          </FormControl>
        );

      default:
        return <JsonEditor field={field} fieldState={fieldState} />;
    }
  })();

  return (
    <>
      {control}
      {hintChips}
    </>
  );
};
