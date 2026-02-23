import React from "react";
import { useState, useCallback, useEffect } from "react";

import { json } from "@codemirror/lang-json";
import { lintGutter } from "@codemirror/lint";
import { TextField, FormLabel, Switch, Box, Typography } from "@mui/material";
import CodeMirror from "@uiw/react-codemirror";

interface JsonInputProps {
  field: {
    value: any;
    name: string;
    onChange: (val: any) => void;
  };
}

const JsonInput: React.FC<JsonInputProps> = ({ field }) => {
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

  return (
    <div>
      <FormLabel>Default</FormLabel>
      <CodeMirror
        extensions={[json(), lintGutter()]}
        value={jsonStr}
        onChange={handleChange}
        style={{ border: "1px solid silver" }}
      />
      {error && <FormLabel color="error">{error}</FormLabel>}
    </div>
  );
};

export const DefaultValueInput = (props: {
  config_type: string;
  field: any;
  error?: boolean;
  helperText?: string;
}) => {
  const { config_type, field, error, helperText } = props;

  switch (config_type) {
    case "string":
      return (
        <TextField
          {...field}
          value={field.value ?? ""}
          label="Default value"
          variant="outlined"
          fullWidth
          margin="normal"
          error={error}
          helperText={helperText}
        />
      );

    case "number":
      return (
        <TextField
          {...field}
          value={
            field.value === null || field.value === undefined
              ? ""
              : Number(field.value)
          }
          label="Default value"
          type="number"
          variant="outlined"
          fullWidth
          margin="normal"
          error={error}
          helperText={helperText}
        />
      );

    case "boolean":
      return (
        <Box sx={{ margin: "16px 0 8px 0" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              variant="body2"
              color={!field.value ? "primary" : "text.secondary"}
            >
              Disabled
            </Typography>
            <Switch
              checked={field.value ?? false}
              onChange={(e) => field.onChange(e.target.checked)}
              color="primary"
              slotProps={{
                input: {
                  "aria-label":
                    "Toggle default boolean value between disabled and enabled",
                },
              }}
            />
            <Typography
              variant="body2"
              color={field.value ? "primary" : "text.secondary"}
            >
              Enabled
            </Typography>
          </Box>
        </Box>
      );
    case "object":
      return <JsonInput field={field} />;
    case "array[string]":
      return <JsonInput field={field} />;
    default:
      return (
        <TextField
          {...field}
          label="Default"
          variant="outlined"
          fullWidth
          margin="normal"
          error={error}
          helperText={helperText}
        />
      );
  }
};
