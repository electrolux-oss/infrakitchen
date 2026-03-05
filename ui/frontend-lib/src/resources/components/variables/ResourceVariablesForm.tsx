import { Controller, useFormContext } from "react-hook-form";

import { TableCell, TableRow, Typography, Chip, useTheme } from "@mui/material";

import { ValidationRule } from "../../../types";
import { ResourceVariableSchema } from "../../types";
import { validateResourceVariableValue } from "../../utils/validationRules";

import { ResourceVariableInput } from "./ResourceVariableInput";

// ── Visual-only row (no react-hook-form dependency) ──────────────────────

export interface ResourceVariableRowProps {
  variable: ResourceVariableSchema;
  field: { value: any; name: string; onChange: (value: any) => void };
  fieldState?: Record<string, any>;
  isDisabled?: boolean;
  validationSummary?: string | null;
  /** When true, applies a subtle highlight to indicate the value comes from a default */
  hasDefault?: boolean;
  /** Optional content to render instead of the default ResourceVariableInput */
  children?: React.ReactNode;
}

export const ResourceVariableRow = ({
  variable,
  field,
  fieldState = {},
  isDisabled = false,
  validationSummary,
  hasDefault = false,
  children,
}: ResourceVariableRowProps) => {
  const theme = useTheme();

  return (
    <TableRow
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
    >
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
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: "block" }}
        >
          {variable.description}
        </Typography>

        <Chip
          label={variable.type}
          size="small"
          color="default"
          sx={{
            fontWeight: "bold",
            letterSpacing: 0.5,
          }}
        />
        {validationSummary && (
          <Chip
            label={validationSummary}
            size="small"
            color="success"
            variant="outlined"
            sx={{ ml: 1 }}
          />
        )}
      </TableCell>
      <TableCell sx={{ width: "300px" }}>
        {children ?? (
          <ResourceVariableInput
            isDisabled={isDisabled}
            variable={variable}
            field={field}
            fieldState={fieldState}
          />
        )}
      </TableCell>
    </TableRow>
  );
};

// ── Form-connected row (uses react-hook-form Controller) ─────────────────

export const ResourceVariableForm = (props: {
  index: number;
  variable: ResourceVariableSchema;
  edit_mode?: boolean;
  validationSummary?: string | null;
  validationRule?: ValidationRule | null;
}) => {
  const {
    index,
    variable,
    edit_mode = false,
    validationSummary,
    validationRule,
  } = props;
  const { control } = useFormContext();

  if (variable.restricted) return null;
  if (variable.sensitive) return null;

  return (
    <Controller
      rules={{
        validate: (value) =>
          validateResourceVariableValue(value, variable, validationRule),
      }}
      name={`variables.${index}.value`}
      control={control}
      render={({ field, fieldState }) => (
        <ResourceVariableRow
          variable={variable}
          field={field}
          fieldState={fieldState}
          isDisabled={edit_mode && variable.frozen}
          validationSummary={validationSummary}
        />
      )}
    />
  );
};
