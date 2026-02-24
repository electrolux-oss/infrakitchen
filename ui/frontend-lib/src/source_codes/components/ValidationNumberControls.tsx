import { useMemo } from "react";

import { Control, Controller, useFormContext, useWatch } from "react-hook-form";

import { Box, Button, Stack, TextField, Typography } from "@mui/material";

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
    () => `configs.${index}.validation_min_value`,
    [index],
  );
  const maxFieldName = useMemo(
    () => `configs.${index}.validation_max_value`,
    [index],
  );
  const ruleIdFieldName = useMemo(
    () => `configs.${index}.validation_rule_id`,
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
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Set optional numeric boundaries for this variable. Leave a field blank
        to skip that constraint entirely.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
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
      </Stack>
      <Button
        variant="text"
        color="secondary"
        sx={{ mt: 2, alignSelf: "flex-start" }}
        onClick={clearValues}
        disabled={!hasAnyValue}
      >
        Clear Validation
      </Button>
    </Box>
  );
};
