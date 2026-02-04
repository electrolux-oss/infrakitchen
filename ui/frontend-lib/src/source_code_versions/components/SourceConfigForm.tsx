import { Controller, Control, useWatch, useFormState } from "react-hook-form";

import InfoOutlined from "@mui/icons-material/InfoOutlined";
import {
  TextField,
  Autocomplete,
  Chip,
  Checkbox,
  FormControlLabel,
  Typography,
  Box,
  Stack,
  Tooltip,
} from "@mui/material";

import { OverviewCard } from "../../common/components/OverviewCard";

import { DefaultValueInput } from "./ConfigInputs";
import { ConfigReferenceInput } from "./ConfigReferenceInput";

export const SourceConfigForm = (props: {
  control: Control<any>;
  index: number;
  fieldId: string;
}) => {
  const { control, index } = props;

  const formState = useFormState({ control });
  const configsErrors = formState.errors?.configs as any;
  const errors = configsErrors?.[index];

  const configName = useWatch({ control, name: `configs.${index}.name` });
  const configType = useWatch({ control, name: `configs.${index}.type` });
  const configDescription = useWatch({
    control,
    name: `configs.${index}.description`,
  });
  const required = useWatch({ control, name: `configs.${index}.required` });
  const restricted = useWatch({ control, name: `configs.${index}.restricted` });
  const sensitive = useWatch({ control, name: `configs.${index}.sensitive` });
  const minValidationValue = useWatch({
    control,
    name: `configs.${index}.validation.min_value`,
  });
  const maxValidationValue = useWatch({
    control,
    name: `configs.${index}.validation.max_value`,
  });

  const parseNumericInput = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const numericValue =
      typeof value === "number" ? value : Number.parseFloat(String(value));
    return Number.isNaN(numericValue) ? null : numericValue;
  };

  const isDirty = formState.dirtyFields?.configs?.[index];
  const hasChanges = Boolean(isDirty);

  return (
    <Box sx={{ width: "100%", mb: 2 }}>
      <Box
        sx={{
          borderLeft: "4px solid",
          borderLeftColor: hasChanges ? "#1976d2" : "transparent",
          transition: "border-left-color 0.3s ease-in-out",
        }}
      >
        <OverviewCard
          name={
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="body1"
                  color="text.primary"
                  fontWeight="bold"
                  component="span"
                >
                  {configName}
                </Typography>
                <Chip label={configType} size="small" variant="outlined" />
                {required ? (
                  <Chip
                    label="required"
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                ) : (
                  <Chip
                    label="optional"
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                )}
                {restricted && (
                  <Chip
                    label="restricted"
                    size="small"
                    color="error"
                    variant="outlined"
                  />
                )}
                {sensitive && (
                  <Chip
                    label="sensitive"
                    size="small"
                    color="secondary"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>
          }
          description={configDescription}
        >
          {sensitive && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="error">
                This config is marked as sensitive and cannot be viewed or used
                in final configurations.
              </Typography>
            </Box>
          )}
          {!sensitive && (
            <Box sx={{ flexGrow: 1, p: 2 }}>
              <Stack direction="column" spacing={1} sx={{ mb: 2 }}>
                {configType !== "boolean" && (
                  <Box>
                    <Controller
                      name={`configs.${index}.default`}
                      rules={{
                        validate: (value) => {
                          const isRestricted = restricted;
                          if (
                            isRestricted &&
                            required &&
                            (value === "" ||
                              value === null ||
                              value === undefined)
                          ) {
                            return "Default value is required when the field is marked as Restricted.";
                          }
                          return true;
                        },
                      }}
                      control={control}
                      render={({ field, fieldState: { error } }) => (
                        <DefaultValueInput
                          config_type={configType}
                          field={field}
                          error={!!error}
                          helperText={error?.message}
                        />
                      )}
                    />
                  </Box>
                )}
                {configType === "string" && (
                  <Box
                    sx={{
                      flexGrow: 1,
                    }}
                  >
                    <Controller
                      name={`configs.${index}.options`}
                      control={control}
                      render={({ field }) => (
                        <Autocomplete
                          multiple
                          freeSolo
                          options={[]}
                          value={field.value || []}
                          onChange={(_event, newValue) =>
                            field.onChange(newValue)
                          }
                          slotProps={{
                            chip: {
                              variant: "outlined",
                              size: "small",
                            },
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Options"
                              variant="outlined"
                              error={!!errors?.options}
                              helperText={
                                errors?.options
                                  ? String(errors.options.message)
                                  : "Add options and press Enter"
                              }
                              fullWidth
                              margin="normal"
                            />
                          )}
                        />
                      )}
                    />
                  </Box>
                )}
              </Stack>

              {configType === "number" && (
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={{ xs: 1, md: 2 }}
                  sx={{ mb: 2 }}
                >
                  <Controller
                    name={`configs.${index}.validation.min_value`}
                    control={control}
                    rules={{
                      validate: (value) => {
                        if (value === null || value === undefined) {
                          return true;
                        }
                        const numericValue = parseNumericInput(value);
                        if (numericValue === null) {
                          return "Enter a valid number";
                        }
                        const normalizedMax =
                          parseNumericInput(maxValidationValue);
                        if (
                          normalizedMax !== null &&
                          numericValue > normalizedMax
                        ) {
                          return "Minimum cannot exceed maximum";
                        }
                        return true;
                      },
                    }}
                    render={({ field, fieldState: { error } }) => (
                      <TextField
                        {...field}
                        type="number"
                        value={
                          field.value === null || field.value === undefined
                            ? ""
                            : field.value
                        }
                        onChange={(event) => {
                          const { value } = event.target;
                          field.onChange(
                            value === "" ? null : Number.parseFloat(value),
                          );
                        }}
                        label="Min value"
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        error={!!error}
                        helperText={error?.message}
                      />
                    )}
                  />
                  <Controller
                    name={`configs.${index}.validation.max_value`}
                    control={control}
                    rules={{
                      validate: (value) => {
                        if (value === null || value === undefined) {
                          return true;
                        }
                        const numericValue = parseNumericInput(value);
                        if (numericValue === null) {
                          return "Enter a valid number";
                        }
                        const normalizedMin =
                          parseNumericInput(minValidationValue);
                        if (
                          normalizedMin !== null &&
                          numericValue < normalizedMin
                        ) {
                          return "Maximum cannot be less than minimum";
                        }
                        return true;
                      },
                    }}
                    render={({ field, fieldState: { error } }) => (
                      <TextField
                        {...field}
                        type="number"
                        value={
                          field.value === null || field.value === undefined
                            ? ""
                            : field.value
                        }
                        onChange={(event) => {
                          const { value } = event.target;
                          field.onChange(
                            value === "" ? null : Number.parseFloat(value),
                          );
                        }}
                        label="Max value"
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        error={!!error}
                        helperText={error?.message}
                      />
                    )}
                  />
                </Stack>
              )}

              {configType === "string" && (
                <Box sx={{ mt: 1, mb: 1 }}>
                  <Controller
                    name={`configs.${index}.validation.regex`}
                    control={control}
                    rules={{
                      validate: (value) => {
                        if (!value) {
                          return true;
                        }
                        try {
                          RegExp(value);
                          return true;
                        } catch (_error) {
                          return "Enter a valid regular expression";
                        }
                      },
                    }}
                    render={({ field, fieldState: { error } }) => (
                      <TextField
                        {...field}
                        value={field.value ?? ""}
                        onChange={(event) => {
                          const { value } = event.target;
                          field.onChange(value === "" ? null : value);
                        }}
                        label={
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            Regex pattern
                            <Tooltip title="Use JavaScript regex syntax without surrounding slashes. Leave empty to accept any string.">
                              <InfoOutlined fontSize="small" color="action" />
                            </Tooltip>
                          </Box>
                        }
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        error={!!error}
                        helperText={error?.message}
                      />
                    )}
                  />
                </Box>
              )}

              {configType === "boolean" && (
                <Box sx={{ mb: 2, mt: -5 }}>
                  <Controller
                    name={`configs.${index}.default`}
                    control={control}
                    render={({ field }) => (
                      <DefaultValueInput
                        config_type={configType}
                        field={field}
                      />
                    )}
                  />
                </Box>
              )}

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                sx={{ mb: 2 }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={{ xs: 1, md: 2 }}
                  alignItems="flex-start"
                  sx={{ flexGrow: 1 }}
                >
                  <Box>
                    <Controller
                      name={`configs.${index}.required`}
                      control={control}
                      render={({ field }) => (
                        <Tooltip title="When checked, this field cannot be left empty during creation or updates.">
                          <FormControlLabel
                            control={
                              <Checkbox {...field} checked={field.value} />
                            }
                            label="Required"
                          />
                        </Tooltip>
                      )}
                    />
                  </Box>
                  <Box>
                    <Controller
                      name={`configs.${index}.frozen`}
                      control={control}
                      render={({ field }) => (
                        <Tooltip title="When checked, the value of this field cannot be changed after the initial creation.">
                          <FormControlLabel
                            control={
                              <Checkbox {...field} checked={field.value} />
                            }
                            label="Frozen"
                          />
                        </Tooltip>
                      )}
                    />
                  </Box>
                  <Box>
                    <Controller
                      name={`configs.${index}.unique`}
                      control={control}
                      render={({ field }) => (
                        <Tooltip title="When checked, this field must have a unique value across all instances.">
                          <FormControlLabel
                            control={
                              <Checkbox {...field} checked={field.value} />
                            }
                            label="Unique"
                          />
                        </Tooltip>
                      )}
                    />
                  </Box>
                  <Box>
                    <Controller
                      name={`configs.${index}.restricted`}
                      control={control}
                      render={({ field }) => (
                        <Tooltip title="When checked, this field will be hidden during creation, default value should be provided.">
                          <FormControlLabel
                            control={
                              <Checkbox {...field} checked={field.value} />
                            }
                            label="Restricted"
                          />
                        </Tooltip>
                      )}
                    />
                  </Box>
                </Stack>
                <ConfigReferenceInput control={control} index={index} />
              </Stack>
            </Box>
          )}
        </OverviewCard>
      </Box>
    </Box>
  );
};
