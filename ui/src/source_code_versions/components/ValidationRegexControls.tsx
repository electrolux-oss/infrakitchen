import { useCallback, useEffect, useMemo, useState } from "react";

import { Control, Controller, useFormContext, useWatch } from "react-hook-form";

import {
  Autocomplete,
  Alert,
  FormControlLabel,
  Switch,
  TextField,
} from "../../ui";
import { useSourceCodeVersionConfigContext } from "../context/SourceCodeVersionConfigContext";
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

interface RegexOption {
  id: string;
  label: string;
  regex: string;
}

export const ValidationRegexControls = ({
  control,
  index,
}: ValidationRegexControlsProps) => {
  const { setValue } = useFormContext();
  const { validationRulesCatalog } = useSourceCodeVersionConfigContext();
  const fieldName = useMemo(() => `configs.${index}.validationRegex`, [index]);
  const ruleIdFieldName = useMemo(
    () => `configs.${index}.validationRuleId`,
    [index],
  );
  const regexValue = useWatch({
    control,
    name: fieldName,
  }) as string | undefined;
  const regexOptions = useMemo<RegexOption[]>(() => {
    if (!validationRulesCatalog || validationRulesCatalog.length === 0) {
      return [];
    }

    const seen = new Map<string, RegexOption>();

    validationRulesCatalog.forEach((rule) => {
      if (!rule.description || !rule.regex_pattern) {
        return;
      }

      const key = rule.id ? String(rule.id) : rule.regex_pattern;
      if (seen.has(key)) {
        return;
      }

      seen.set(key, {
        id: key,
        label: rule.description,
        regex: rule.regex_pattern,
      });
    });

    return Array.from(seen.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [validationRulesCatalog]);

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
  const [testResult, setTestResult] = useState<
    "match" | "no-match" | "no-length-match" | null
  >(null);
  const hasInfiniteMax = lengths.max.trim().toLowerCase() === "infinity";

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
      if (regex.test(testValue)) {
        setTestResult("match");
        return;
      }

      const parsed = parseSimpleRegex(regexValue);
      if (!parsed) {
        setTestResult("no-match");
        return;
      }

      const charsetRegex = new RegExp(
        buildRegexFromState(parsed.toggles, 0, Number.POSITIVE_INFINITY),
      );
      if (charsetRegex.test(testValue)) {
        setTestResult("no-length-match");
        return;
      }

      setTestResult("no-match");
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
      setValue(ruleIdFieldName, null, { shouldDirty: true, shouldTouch: true });
    },
    [fieldName, regexValue, ruleIdFieldName, setValue],
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
      if (key === "max" && hasInfiniteMax) {
        return;
      }

      const numericOnly = value.replace(/[^0-9]/g, "");
      const nextLengths = { ...lengths, [key]: numericOnly };
      setLengths(nextLengths);

      if (isComplexRegex) {
        return;
      }

      applyGeneratedRegex(toggleState, nextLengths);
    },
    [applyGeneratedRegex, hasInfiniteMax, isComplexRegex, lengths, toggleState],
  );

  const handleInfiniteMaxToggle = useCallback(
    (checked: boolean) => {
      const normalizedMin = Number(lengths.min || "0");
      const nextMin =
        checked && Number.isFinite(normalizedMin) && normalizedMin > 1
          ? "1"
          : lengths.min;
      const nextLengths = {
        min: nextMin,
        max: checked ? "Infinity" : "64",
      };

      setLengths(nextLengths);

      if (isComplexRegex) {
        return;
      }

      applyGeneratedRegex(toggleState, nextLengths);
    },
    [applyGeneratedRegex, isComplexRegex, lengths.min, toggleState],
  );

  return (
    <div className="mt-4">
      <p className="m-0 text-body2 text-fg-muted">
        Provide a regular expression for this variable or use the toggles to
        generate one automatically.
      </p>
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
        render={({ field, fieldState }) => {
          const selectedOption =
            regexOptions.find((option) => option.regex === field.value) ?? null;

          return (
            <Autocomplete<RegexOption, false, true>
              freeSolo
              options={regexOptions}
              value={selectedOption}
              inputValue={field.value || ""}
              onInputChange={(_, newInputValue, reason) => {
                if (reason === "input" || reason === "clear") {
                  field.onChange(newInputValue);
                  setValue(ruleIdFieldName, null, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }
              }}
              onChange={(_, newValue) => {
                if (typeof newValue === "string") {
                  field.onChange(newValue);
                  setValue(ruleIdFieldName, null, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                } else if (newValue) {
                  field.onChange(newValue.regex);
                  setValue(ruleIdFieldName, newValue.id, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                } else {
                  field.onChange("");
                  setValue(ruleIdFieldName, null, {
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }
              }}
              isOptionEqualToValue={(option, value) =>
                typeof value === "string"
                  ? option.regex === value
                  : option.regex === value.regex
              }
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option.label
              }
              getOptionKey={(option) =>
                typeof option === "string" ? option : option.id
              }
              renderOption={(option) => (
                <div className="flex flex-col">
                  <p className="m-0 text-body2">{option.label}</p>
                  <span className="text-caption text-fg-muted">
                    {option.regex}
                  </span>
                </div>
              )}
              inputClassName="font-mono"
              label="Validation Regex"
              placeholder="e.g. ^[a-zA-Z0-9]{1,64}$"
              fullWidth
              margin="normal"
              onBlur={field.onBlur}
              error={Boolean(fieldState.error)}
              helperText={
                fieldState.error?.message ||
                (selectedOption
                  ? `Selected rule: ${selectedOption.label}`
                  : "Select a predefined rule or enter a custom regex.")
              }
            />
          );
        }}
      />
      {isComplexRegex && (
        <Alert className="mt-2" severity="warning">
          This regex is too complex to edit using toggles.
        </Alert>
      )}
      <div className="m-4 flex flex-col flex-wrap gap-2 sm:flex-row">
        {TOGGLE_DEFINITIONS.map((definition) => (
          <div className="min-w-55" key={definition.key}>
            <FormControlLabel
              control={
                <Switch
                  checked={toggleState[definition.key]}
                  onChange={(_, checked) =>
                    handleToggleChange(definition.key, checked)
                  }
                  disabled={isComplexRegex}
                />
              }
              label={definition.label}
            />
          </div>
        ))}
      </div>
      {toggleError && (
        <span className="mt-1 block text-caption text-error">
          {toggleError}
        </span>
      )}
      <div className="mt-8 flex flex-col items-baseline gap-4 sm:flex-row">
        <TextField
          label="Min length"
          type="text"
          inputMode="numeric"
          value={lengths.min}
          onChange={(event) => handleLengthChange("min", event.target.value)}
          disabled={isComplexRegex}
          fullWidth
          helperText="Set a minimum length for the input."
        />
        <TextField
          label="Max length"
          type="text"
          inputMode="numeric"
          value={lengths.max}
          onChange={(event) => handleLengthChange("max", event.target.value)}
          disabled={isComplexRegex || hasInfiniteMax}
          fullWidth
          helperText={
            hasInfiniteMax
              ? "Infinite max is enabled."
              : "Set an upper bound or enable infinite length."
          }
        />
        <FormControlLabel
          className="mt-2 min-w-50"
          control={
            <Switch
              checked={hasInfiniteMax}
              onChange={(_, checked) => handleInfiniteMaxToggle(checked)}
              disabled={isComplexRegex}
            />
          }
          label="Infinite max length"
        />
      </div>
      {lengthError && (
        <span className="mt-1 block text-caption text-error">
          {lengthError}
        </span>
      )}
      <TextField
        className="mt-4"
        label="Test Input"
        value={testValue}
        onChange={(event) => setTestValue(event.target.value)}
        fullWidth
        error={testResult === "no-match" || testResult === "no-length-match"}
        helperText={
          testResult === "match"
            ? "Value matches the current regex."
            : testResult === "no-length-match"
              ? "Value matches allowed characters, but its length is outside the configured range."
              : testResult === "no-match"
                ? "Value does not match the current regex."
                : "Enter a sample value to test against this regex."
        }
      />
    </div>
  );
};
