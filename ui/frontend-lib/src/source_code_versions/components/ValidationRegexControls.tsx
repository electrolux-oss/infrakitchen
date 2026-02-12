import { useCallback, useEffect, useMemo, useState } from "react";

import { Control, Controller, useFormContext, useWatch } from "react-hook-form";

import {
  Alert,
  Box,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import {
  buildRegexFromState,
  DEFAULT_TOGGLE_STATE,
  EMPTY_TOGGLE_STATE,
  LengthState,
  parseLengths,
  parseSimpleRegex,
  TOGGLE_KEYS,
  ToggleKey,
} from "../utils/regex";

interface ToggleDefinition {
  key: ToggleKey;
  label: string;
  helper: string;
}

const TOGGLE_DEFINITIONS: ToggleDefinition[] = [
  {
    key: "lowercase",
    label: "Lowercase letters (a-z)",
    helper: "Allow letters from a to z",
  },
  {
    key: "uppercase",
    label: "Uppercase letters (A-Z)",
    helper: "Allow letters from A to Z",
  },
  {
    key: "digits",
    label: "Digits (0-9)",
    helper: "Allow numeric characters",
  },
  {
    key: "underscore",
    label: "Underscore (_)",
    helper: "Allow underscore characters",
  },
  {
    key: "dash",
    label: "Dash (-)",
    helper: "Allow hyphen characters",
  },
  {
    key: "whitespace",
    label: "Whitespaces (\\s)",
    helper: "Allow whitespace characters",
  },
];

interface ValidationRegexControlsProps {
  control: Control<any>;
  index: number;
}

export const ValidationRegexControls = ({
  control,
  index,
}: ValidationRegexControlsProps) => {
  const { setValue } = useFormContext();
  const fieldName = useMemo(() => `configs.${index}.validation_regex`, [index]);
  const regexValue = useWatch({
    control,
    name: fieldName,
  }) as string | undefined;

  const [toggleState, setToggleState] =
    useState<Record<ToggleKey, boolean>>(DEFAULT_TOGGLE_STATE);
  const [lengths, setLengths] = useState<LengthState>({
    min: "1",
    max: "Infinity",
  });
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [lengthError, setLengthError] = useState<string | null>(null);
  const [isComplexRegex, setIsComplexRegex] = useState(false);
  const [testValue, setTestValue] = useState("");
  const [testResult, setTestResult] = useState<"match" | "no-match" | null>(
    null,
  );

  useEffect(() => {
    if (!regexValue) {
      setIsComplexRegex(false);
      setToggleState(DEFAULT_TOGGLE_STATE);
      setToggleError(null);
      return;
    }

    const parsed = parseSimpleRegex(regexValue);
    if (!parsed) {
      setIsComplexRegex(true);
      setToggleState(EMPTY_TOGGLE_STATE);
      return;
    }

    setIsComplexRegex(false);
    setToggleState(parsed.toggles);
    setLengths({ min: String(parsed.min), max: String(parsed.max) });
    setToggleError(null);
    setLengthError(null);
  }, [regexValue]);

  useEffect(() => {
    if (!regexValue || testValue === "") {
      setTestResult(null);
      return;
    }

    try {
      const regex = new RegExp(regexValue);
      setTestResult(regex.test(testValue) ? "match" : "no-match");
    } catch {
      setTestResult(null);
    }
  }, [regexValue, testValue]);

  const applyGeneratedRegex = useCallback(
    (state: Record<ToggleKey, boolean>, lengthState: LengthState) => {
      const fragments = TOGGLE_KEYS.filter((key) => state[key]);
      if (fragments.length === 0) {
        setToggleError("At least one character set must remain enabled.");
        return;
      }
      setToggleError(null);

      const { valid, error, min, max } = parseLengths(lengthState);
      if (!valid || min === undefined || max === undefined) {
        setLengthError(error);
        return;
      }
      setLengthError(null);

      const nextRegex = buildRegexFromState(state, min, max);
      if (regexValue === nextRegex) {
        return;
      }

      setValue(fieldName, nextRegex, { shouldDirty: true, shouldTouch: true });
    },
    [fieldName, regexValue, setValue],
  );

  const handleToggleChange = useCallback(
    (key: ToggleKey, checked: boolean) => {
      if (isComplexRegex) {
        return;
      }

      const nextState = { ...toggleState, [key]: checked };
      if (!Object.values(nextState).some(Boolean)) {
        setToggleError("At least one character set must remain enabled.");
        return;
      }

      setToggleState(nextState);
      applyGeneratedRegex(nextState, lengths);
    },
    [applyGeneratedRegex, isComplexRegex, lengths, toggleState],
  );

  const handleLengthChange = useCallback(
    (key: keyof LengthState, value: string) => {
      const numericOnly = value.replace(/[^0-9]/g, "");
      const nextLengths = { ...lengths, [key]: numericOnly };
      setLengths(nextLengths);

      if (isComplexRegex) {
        return;
      }

      applyGeneratedRegex(toggleState, nextLengths);
    },
    [applyGeneratedRegex, isComplexRegex, lengths, toggleState],
  );

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Provide a regular expression for this variable or use the toggles to
        generate one automatically. Leave the field blank to skip validation.
      </Typography>
      <Controller
        name={fieldName}
        control={control}
        rules={{
          validate: (value) => {
            if (!value) {
              return true;
            }

            try {
              RegExp(value);
            } catch (error: any) {
              return error?.message || "Invalid regular expression.";
            }

            if (/^\^\[\]\{\d+,\d+\}\$/.test(value)) {
              return "Empty character classes are not allowed.";
            }

            return true;
          },
        }}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            value={field.value || ""}
            label="Validation Regex"
            placeholder="e.g. ^[a-zA-Z0-9]{1,64}$"
            fullWidth
            multiline
            minRows={2}
            margin="normal"
            InputProps={{
              sx: {
                fontFamily:
                  '"Roboto Mono", "SFMono-Regular", "Menlo", monospace',
              },
            }}
            error={Boolean(fieldState.error)}
            helperText={
              fieldState.error?.message ||
              "This value is saved as-is. Leave it blank to disable validation."
            }
          />
        )}
      />

      {isComplexRegex && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          This regex is too complex to edit using toggles.
        </Alert>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          m: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
        useFlexGap
      >
        {TOGGLE_DEFINITIONS.map((definition) => (
          <Box key={definition.key} sx={{ minWidth: 220 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={toggleState[definition.key]}
                  onChange={(_, checked) =>
                    handleToggleChange(definition.key, checked)
                  }
                  disabled={isComplexRegex}
                />
              }
              label={definition.label}
            />
          </Box>
        ))}
      </Stack>

      {toggleError && (
        <Typography
          variant="caption"
          color="error"
          sx={{ display: "block", mt: 0.5 }}
        >
          {toggleError}
        </Typography>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 4 }}>
        <TextField
          label="Min length"
          type="text"
          inputMode="numeric"
          value={lengths.min}
          onChange={(event) => handleLengthChange("min", event.target.value)}
          disabled={isComplexRegex}
          fullWidth
        />
        <TextField
          label="Max length"
          type="text"
          inputMode="numeric"
          value={lengths.max}
          onChange={(event) => handleLengthChange("max", event.target.value)}
          disabled={isComplexRegex}
          fullWidth
        />
      </Stack>

      {lengthError && (
        <Typography
          variant="caption"
          color="error"
          sx={{ display: "block", mt: 0.5 }}
        >
          {lengthError}
        </Typography>
      )}

      <TextField
        label="Test Input"
        value={testValue}
        onChange={(event) => setTestValue(event.target.value)}
        sx={{ mt: 2 }}
        fullWidth
        error={testResult === "no-match"}
        color={testResult === "match" ? "success" : undefined}
        helperText={
          testResult === "match"
            ? "Value matches the current regex."
            : testResult === "no-match"
              ? "Value does not match the current regex."
              : "Enter a sample value to test against this regex."
        }
      />
    </Box>
  );
};
