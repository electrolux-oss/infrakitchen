import React from "react";
import { useState, useCallback, useEffect } from "react";

import { json } from "@codemirror/lang-json";
import { lintGutter } from "@codemirror/lint";
import CodeMirror from "@uiw/react-codemirror";

import { Switch, TextField, FormLabel } from "../../ui";
import { cn } from "../../utils/cn";

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
        style={{ border: "1px solid var(--color-divider)" }}
      />
      {error && <FormLabel>{error}</FormLabel>}
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
          fullWidth
          margin="normal"
          error={error}
          helperText={helperText}
        />
      );

    case "boolean":
      return (
        <div className="mt-4 mb-2">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "m-0 text-body2",
                !field.value ? "text-primary" : "text-fg-muted",
              )}
            >
              Disabled
            </p>
            <Switch
              checked={field.value ?? false}
              onChange={(e) => field.onChange(e.target.checked)}
              inputProps={{
                "aria-label":
                  "Toggle default boolean value between disabled and enabled",
              }}
            />
            <p
              className={cn(
                "m-0 text-body2",
                field.value ? "text-primary" : "text-fg-muted",
              )}
            >
              Enabled
            </p>
          </div>
        </div>
      );
    case "object":
      return <JsonInput field={field} />;
    case "array[string]":
      return <JsonInput field={field} />;
    case "array[object]":
      return <JsonInput field={field} />;
    default:
      return (
        <TextField
          {...field}
          label="Default"
          fullWidth
          margin="normal"
          error={error}
          helperText={helperText}
        />
      );
  }
};
