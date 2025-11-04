import { Controller, useFormContext } from "react-hook-form";

import { TableCell, TableRow, Typography, Chip } from "@mui/material";

import { ResourceVariableSchema } from "../../types";

import { ResourceVariableInput } from "./ResourceVariableInput";

export const ResourceVariableForm = (props: {
  index: number;
  variable: ResourceVariableSchema;
  edit_mode?: boolean;
}) => {
  const { index, variable, edit_mode = false } = props;
  const { control } = useFormContext();

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
