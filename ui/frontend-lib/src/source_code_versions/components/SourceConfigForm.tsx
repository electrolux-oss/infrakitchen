import { useState } from "react";

import {
  Controller,
  Control,
  useWatch,
  useFormState,
  useFormContext,
} from "react-hook-form";

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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
} from "@mui/material";

import { OverviewCard } from "../../common/components/OverviewCard";

import { DefaultValueInput } from "./ConfigInputs";
import { ConfigReferenceInput } from "./ConfigReferenceInput";
import { ValidationNumberControls } from "./ValidationNumberControls";
import { ValidationRegexControls } from "./ValidationRegexControls";

export const SourceConfigForm = (props: {
  control: Control<any>;
  index: number;
  fieldId: string;
}) => {
  const { control, index } = props;
  const [isStringValidationOpen, setIsStringValidationOpen] = useState(false);
  const [isNumberValidationOpen, setIsNumberValidationOpen] = useState(false);

  const { setValue } = useFormContext();
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
  const validationEnabledField = `configs.${index}.validation_enabled` as const;
  const validationRuleIdField = `configs.${index}.validation_rule_id` as const;
  const validationRegexField = `configs.${index}.validation_regex` as const;
  const validationMinValueField =
    `configs.${index}.validation_min_value` as const;
  const validationMaxValueField =
    `configs.${index}.validation_max_value` as const;
  const validationEnabled = Boolean(
    useWatch({ control, name: validationEnabledField, defaultValue: false }),
  );

  const isDirty = formState.dirtyFields?.configs?.[index];
  const hasChanges = Boolean(isDirty);

  const handleValidationToggle = (
    enabled: boolean,
    onFieldChange: (value: boolean) => void,
    type: "string" | "number",
  ) => {
    onFieldChange(enabled);

    if (!enabled) {
      setValue(validationRuleIdField, null, {
        shouldDirty: true,
        shouldTouch: true,
      });

      if (type === "string") {
        setValue(validationRegexField, "", {
          shouldDirty: true,
          shouldTouch: true,
        });
        setIsStringValidationOpen(false);
      } else {
        setValue(validationMinValueField, "", {
          shouldDirty: true,
          shouldTouch: true,
        });
        setValue(validationMaxValueField, "", {
          shouldDirty: true,
          shouldTouch: true,
        });
        setIsNumberValidationOpen(false);
      }

      return;
    }

    if (type === "string") {
      setIsStringValidationOpen(true);
    } else {
      setIsNumberValidationOpen(true);
    }
  };

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
              <Stack direction="column" spacing={1} sx={{ mb: 1 }}>
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

              {configType === "string" && (
                <Accordion
                  expanded={isStringValidationOpen}
                  onChange={(_, expanded) =>
                    setIsStringValidationOpen(expanded)
                  }
                  disableGutters
                  elevation={0}
                  square
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    mt: 1,
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        gap: 2,
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600}>
                        String Validation
                      </Typography>
                      <Controller
                        name={validationEnabledField}
                        control={control}
                        defaultValue={false}
                        render={({ field }) => (
                          <FormControlLabel
                            sx={{ m: 0 }}
                            labelPlacement="start"
                            onClick={(event) => event.stopPropagation()}
                            onFocus={(event) => event.stopPropagation()}
                            label={
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {field.value ? "Enabled" : "Disabled"}
                              </Typography>
                            }
                            control={
                              <Switch
                                name={field.name}
                                inputRef={field.ref}
                                checked={Boolean(field.value)}
                                onClick={(event) => event.stopPropagation()}
                                onFocus={(event) => event.stopPropagation()}
                                onChange={(_, checked) =>
                                  handleValidationToggle(
                                    checked,
                                    field.onChange,
                                    "string",
                                  )
                                }
                                inputProps={{
                                  "aria-label": "Toggle string validation",
                                }}
                              />
                            }
                          />
                        )}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {validationEnabled ? (
                      <ValidationRegexControls
                        control={control}
                        index={index}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Validation is disabled for this variable. Toggle the
                        switch to enable it.
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              )}
              {configType === "number" && (
                <Accordion
                  expanded={isNumberValidationOpen}
                  onChange={(_, expanded) =>
                    setIsNumberValidationOpen(expanded)
                  }
                  disableGutters
                  elevation={0}
                  square
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    mt: 1,
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        gap: 2,
                      }}
                    >
                      <Typography variant="subtitle1" fontWeight={600}>
                        Number Validation
                      </Typography>
                      <Controller
                        name={validationEnabledField}
                        control={control}
                        defaultValue={false}
                        render={({ field }) => (
                          <FormControlLabel
                            sx={{ m: 0 }}
                            labelPlacement="start"
                            onClick={(event) => event.stopPropagation()}
                            onFocus={(event) => event.stopPropagation()}
                            label={
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {field.value ? "Enabled" : "Disabled"}
                              </Typography>
                            }
                            control={
                              <Switch
                                name={field.name}
                                inputRef={field.ref}
                                checked={Boolean(field.value)}
                                onClick={(event) => event.stopPropagation()}
                                onFocus={(event) => event.stopPropagation()}
                                onChange={(_, checked) =>
                                  handleValidationToggle(
                                    checked,
                                    field.onChange,
                                    "number",
                                  )
                                }
                                inputProps={{
                                  "aria-label": "Toggle number validation",
                                }}
                              />
                            }
                          />
                        )}
                      />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {validationEnabled ? (
                      <ValidationNumberControls
                        control={control}
                        index={index}
                      />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Validation is disabled for this variable. Toggle the
                        switch to enable numeric boundaries.
                      </Typography>
                    )}
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          )}
        </OverviewCard>
      </Box>
    </Box>
  );
};
