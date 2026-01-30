import { Controller, useFormContext } from "react-hook-form";

import { TableCell, TableRow, Typography, Chip } from "@mui/material";

import { ResourceVariableSchema, ValidationRule } from "../../types";
import {
  createNumberValidator,
  createStringValidator,
} from "../../utils/validationRules";

import { ResourceVariableInput } from "./ResourceVariableInput";

const buildVariableValidators = (
  variable: ResourceVariableSchema,
  validationRule?: ValidationRule,
): Record<string, (value: any) => true | string> => {
  const validators: Record<string, (value: any) => true | string> = {};

  if (variable.required) {
    validators.required = (value) => {
      if (value === undefined || value === null) {
        return "This field is required";
      }
      if (typeof value === "string" && value.trim().length === 0) {
        return "This field is required";
      }
      return true;
    };
  }

  if (variable.type === "string") {
    const stringValidator = createStringValidator(validationRule);
    if (stringValidator) {
      validators.rule = (value) =>
        stringValidator(value as string | undefined | null);
    }
  } else if (variable.type === "number") {
    const numberValidator = createNumberValidator(validationRule);
    if (numberValidator) {
      validators.rule = (value) =>
        numberValidator(value as number | string | undefined | null);
    }
  }

  return validators;
};

export const ResourceVariableForm = (props: {
  index: number;
  variable: ResourceVariableSchema;
  edit_mode?: boolean;
  validationRule?: ValidationRule;
}) => {
  const { index, variable, edit_mode = false, validationRule } = props;
  const { control } = useFormContext();

  if (variable.restricted) return null;
  if (variable.sensitive) return null;

  const validators = buildVariableValidators(variable, validationRule);
  const rules =
    Object.keys(validators).length > 0 ? { validate: validators } : undefined;

  return (
    <TableRow>
      <TableCell sx={{ width: "320px" }}>
        <Typography
          variant="body1"
          color="text.primary"
          fontWeight="bold"
          component="span"
        >
          {variable.name}
          {variable.required && <span style={{ color: "#d32f2f" }}> *</span>}
        </Typography>
        <Chip
          label={variable.type}
          size="small"
          color="default"
          sx={{
            ml: 1,
            fontWeight: "bold",
            letterSpacing: 0.5,
            verticalAlign: "middle",
          }}
        />
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: "block" }}
        >
          {variable.description}
        </Typography>
      </TableCell>
      <TableCell sx={{ width: "300px" }}>
        <Controller
          rules={rules}
          name={`variables.${index}.value`}
          control={control}
          render={({ field, fieldState }) => (
            <ResourceVariableInput
              isDisabled={edit_mode && variable.frozen}
              variable={variable}
              field={field}
              fieldState={fieldState}
              validationRule={validationRule}
            />
          )}
        />
      </TableCell>
    </TableRow>
  );
};
