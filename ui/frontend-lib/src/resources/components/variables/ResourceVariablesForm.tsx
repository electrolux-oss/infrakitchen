import { Controller, useFormContext } from "react-hook-form";

import { TableCell, TableRow, Typography, Chip } from "@mui/material";

import { ResourceVariableSchema } from "../../types";

import { ResourceVariableInput } from "./ResourceVariableInput";

export const ResourceVariableForm = (props: {
  index: number;
  variable: ResourceVariableSchema;
  edit_mode?: boolean;
  validationSummary?: string | null;
}) => {
  const { index, variable, edit_mode = false, validationSummary } = props;
  const { control } = useFormContext();

  if (variable.restricted) return null;
  if (variable.sensitive) return null;

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
        <Controller
          rules={{
            validate: (value) =>
              variable.required && (value === null || value === undefined)
                ? "This field is required"
                : true,
          }}
          name={`variables.${index}.value`}
          control={control}
          render={({ field, fieldState }) => (
            <ResourceVariableInput
              isDisabled={edit_mode && variable.frozen}
              variable={variable}
              field={field}
              fieldState={fieldState}
            />
          )}
        />
      </TableCell>
    </TableRow>
  );
};
