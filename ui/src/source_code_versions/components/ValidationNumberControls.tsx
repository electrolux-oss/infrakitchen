import { useMemo } from "react";

import { Control, Controller, useFormContext, useWatch } from "react-hook-form";

import { Button, TextField } from "../../ui";
import { formatNumericDisplayValue, parseNumericField } from "../utils/numeric";

interface ValidationNumberControlsProps {
  control: Control<any>;
  index: number;
}

export const ValidationNumberControls = ({
  control,
  index,
}: ValidationNumberControlsProps) => {
  const { getValues, setValue } = useFormContext();
  const minFieldName = useMemo(
    () => `configs.${index}.validationMinValue`,
    [index],
  );
  const maxFieldName = useMemo(
    () => `configs.${index}.validationMaxValue`,
    [index],
  );
  const ruleIdFieldName = useMemo(
    () => `configs.${index}.validationRuleId`,
    [index],
  );

  const minValue = useWatch({ control, name: minFieldName });
  const maxValue = useWatch({ control, name: maxFieldName });

  const hasAnyValue =
    (minValue !== null && minValue !== undefined && minValue !== "") ||
    (maxValue !== null && maxValue !== undefined && maxValue !== "");

  const clearValues = () => {
    setValue(minFieldName, "", { shouldDirty: true, shouldTouch: true });
    setValue(maxFieldName, "", { shouldDirty: true, shouldTouch: true });
    setValue(ruleIdFieldName, null, { shouldDirty: true, shouldTouch: true });
  };

  return (
    <div className="mt-2">
      <p className="m-0 mb-4 text-body2 text-fg-muted">
        Set optional numeric boundaries for this variable. Leave a field blank
        to skip that constraint entirely.
      </p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Controller
          name={minFieldName}
          control={control}
          rules={{
            validate: (value) => {
              if (value === null || value === undefined || value === "") {
                return true;
              }

              const parsed = Number(value);
              if (Number.isNaN(parsed)) {
                return "Enter a valid number.";
              }

              const maxParsed = parseNumericField(getValues(maxFieldName));
              if (maxParsed !== null && parsed > maxParsed) {
                return "Min value cannot exceed max value.";
              }

              return true;
            },
          }}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              value={formatNumericDisplayValue(field.value)}
              label="Min value"
              type="number"
              inputProps={{ step: "any" }}
              onChange={(event) => {
                field.onChange(event.target.value);
                setValue(ruleIdFieldName, null, {
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
              fullWidth
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message || "Optional lower bound."}
            />
          )}
        />
        <Controller
          name={maxFieldName}
          control={control}
          rules={{
            validate: (value) => {
              if (value === null || value === undefined || value === "") {
                return true;
              }

              const parsed = Number(value);
              if (Number.isNaN(parsed)) {
                return "Enter a valid number.";
              }

              const minParsed = parseNumericField(getValues(minFieldName));
              if (minParsed !== null && parsed < minParsed) {
                return "Max value must be greater than or equal to min value.";
              }

              return true;
            },
          }}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              value={formatNumericDisplayValue(field.value)}
              label="Max value"
              type="number"
              inputProps={{ step: "any" }}
              onChange={(event) => {
                field.onChange(event.target.value);
                setValue(ruleIdFieldName, null, {
                  shouldDirty: true,
                  shouldTouch: true,
                });
              }}
              fullWidth
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message || "Optional upper bound."}
            />
          )}
        />
      </div>
      <Button
        className="mt-4 self-start"
        variant="text"
        color="secondary"
        onClick={clearValues}
        disabled={!hasAnyValue}
      >
        Clear Validation
      </Button>
    </div>
  );
};
