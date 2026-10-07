import { ReactNode } from "react";

import { Controller, useFormContext } from "react-hook-form";

import { Typography, Chip, useTheme } from "@mui/material";

import { VariableCard } from "../../../common/components/fields/VariableCard";
import { solidChipColorSx } from "../../../common/utils/softChip";
import { ValidationRule } from "../../../types";
import { ResourceVariableSchema } from "../../types";
import { validateResourceVariableValue } from "../../utils/validationRules";

import { ResourceVariableInput } from "./ResourceVariableInput";

export interface ResourceVariableRowProps {
  variable: ResourceVariableSchema;
  field: { value: any; name: string; onChange: (value: any) => void };
  fieldState?: Record<string, any>;
  isDisabled?: boolean;
  validationSummary?: string | null;
  status?: "existing" | "new" | "deleted";
  /** When true, applies a subtle highlight to indicate the value comes from a default */
  hasDefault?: boolean;
  /** Optional content to render instead of the default ResourceVariableInput */
  children?: ReactNode;
}

export const ResourceVariableRow = ({
  variable,
  field,
  fieldState = {},
  isDisabled = false,
  validationSummary,
  status = "existing",
  hasDefault = false,
  children,
}: ResourceVariableRowProps) => {
  const theme = useTheme();
  const isDeleted = status === "deleted";
  const isNew = status === "new";

  return (
    <VariableCard
      name={variable.name}
      required={variable.required}
      type={variable.type}
      description={variable.description}
      sx={
        hasDefault
          ? {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(255, 167, 38, 0.08)"
                  : "rgba(237, 108, 2, 0.04)",
            }
          : undefined
      }
      chips={
        <>
          {isNew && (
            <Chip
              label="Added"
              sx={{ ml: 1, ...solidChipColorSx("info")(theme) }}
            />
          )}
          {isDeleted && (
            <Chip
              label="Deleted"
              sx={{ ml: 1, ...solidChipColorSx("warning")(theme) }}
            />
          )}
          {validationSummary && (
            <Chip
              label={validationSummary}
              sx={{ ml: 1, ...solidChipColorSx("success")(theme) }}
            />
          )}
        </>
      }
    >
      {isDeleted && (
        <Typography variant="body2" sx={{ color: "warning.main", mb: 1 }}>
          This variable was deleted from the current schema.
        </Typography>
      )}
      {children ?? (
        <ResourceVariableInput
          isDisabled={isDisabled}
          variable={variable}
          field={field}
          fieldState={fieldState}
        />
      )}
    </VariableCard>
  );
};

export const ResourceVariableForm = (props: {
  index: number;
  variable: ResourceVariableSchema;
  edit_mode?: boolean;
  status?: "existing" | "new" | "deleted";
  validationSummary?: string | null;
  validationRule?: ValidationRule | null;
}) => {
  const {
    index,
    variable,
    edit_mode = false,
    status = "existing",
    validationSummary,
    validationRule,
  } = props;
  const { control } = useFormContext();
  const isDeleted = status === "deleted";

  if (variable.restricted) return null;
  if (variable.sensitive) return null;

  return (
    <Controller
      rules={{
        validate: (value) =>
          isDeleted
            ? true
            : validateResourceVariableValue(value, variable, validationRule),
      }}
      name={`variables.${index}.value`}
      control={control}
      render={({ field, fieldState }) => (
        <ResourceVariableRow
          variable={variable}
          field={field}
          fieldState={fieldState}
          isDisabled={isDeleted || (edit_mode && variable.frozen)}
          status={status}
          validationSummary={validationSummary}
        />
      )}
    />
  );
};
