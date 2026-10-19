import { useState } from "react";

import {
  Controller,
  Control,
  useWatch,
  useFormState,
  useFormContext,
} from "react-hook-form";

import { Label } from "../../common/components/labels";
import {
  Autocomplete,
  Divider,
  Checkbox,
  FormControlLabel,
  Switch,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "../../ui";
import { cn } from "../../utils/cn";
import { parseNumericField } from "../utils/numeric";
import { getValidationSummary } from "../utils/validationSummary";

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
  const validationEnabledField = `configs.${index}.validationEnabled` as const;
  const validationRuleIdField = `configs.${index}.validationRuleId` as const;
  const validationRegexField = `configs.${index}.validationRegex` as const;
  const validationMinValueField =
    `configs.${index}.validationMinValue` as const;
  const validationMaxValueField =
    `configs.${index}.validationMaxValue` as const;
  const validationEnabled = Boolean(
    useWatch({ control, name: validationEnabledField, defaultValue: false }),
  );
  const validationMinValue = useWatch({
    control,
    name: validationMinValueField,
  });
  const validationMaxValue = useWatch({
    control,
    name: validationMaxValueField,
  });

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

  const validationSummary = getValidationSummary({
    validationRegex: useWatch({
      control,
      name: `configs.${index}.validationRegex`,
    }),
    validationMinValue: useWatch({
      control,
      name: `configs.${index}.validationMinValue`,
    }),
    validationMaxValue: useWatch({
      control,
      name: `configs.${index}.validationMaxValue`,
    }),
  });

  return (
    <div
      className={cn(
        "border border-l-4 border-divider",
        hasChanges ? "border-l-primary" : "border-l-divider",
        "mb-4 w-full rounded-surface bg-paper p-4 [transition:border-left-color_0.3s_ease-in-out]",
      )}
    >
      <div className="mb-2 flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-subtitle1 font-bold text-fg">{configName}</span>
          <Label size="small" label={configType} />
          {required ? (
            <Label size="small" tone="warning" label="required" />
          ) : (
            <Label size="small" tone="info" label="optional" />
          )}
          {validationSummary && (
            <Label size="small" tone="success" label={validationSummary} />
          )}
          {restricted && <Label size="small" tone="error" label="restricted" />}
          {sensitive && (
            <Label size="small" tone="secondary" label="sensitive" />
          )}
        </div>
      </div>
      {configDescription && (
        <p className="m-0 mb-4 text-body2 text-fg-muted">{configDescription}</p>
      )}
      <Divider className="mb-4" />
      {sensitive && (
        <div className="mb-4">
          <p className="m-0 text-body2 text-error">
            This config is marked as sensitive and cannot be viewed or used in
            final configurations.
          </p>
        </div>
      )}
      {!sensitive && (
        <div>
          <div className="mb-2 flex flex-col gap-2">
            {configType !== "boolean" && (
              <div>
                <Controller
                  name={`configs.${index}.default`}
                  rules={{
                    validate: (value) => {
                      const isRestricted = restricted;
                      if (
                        isRestricted &&
                        required &&
                        (value === "" || value === null || value === undefined)
                      ) {
                        return "Default value is required when the field is marked as Restricted.";
                      }

                      if (configType !== "number") {
                        return true;
                      }

                      if (
                        value === "" ||
                        value === null ||
                        value === undefined
                      ) {
                        return true;
                      }

                      const parsedDefault = parseNumericField(value);
                      if (parsedDefault === null) {
                        return "Default value must be a valid number.";
                      }

                      const parsedMin = parseNumericField(validationMinValue);
                      const parsedMax = parseNumericField(validationMaxValue);

                      if (parsedMin !== null && parsedDefault < parsedMin) {
                        return `Default value must be greater than or equal to min value (${parsedMin}).`;
                      }

                      if (parsedMax !== null && parsedDefault > parsedMax) {
                        return `Default value must be less than or equal to max value (${parsedMax}).`;
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
              </div>
            )}
            {configType === "string" && (
              <div className="grow">
                <Controller
                  name={`configs.${index}.options`}
                  control={control}
                  render={({ field }) => (
                    <Autocomplete
                      multiple
                      freeSolo
                      options={[] as string[]}
                      value={field.value || []}
                      onChange={(_event, newValue) => field.onChange(newValue)}
                      label="Options"
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
              </div>
            )}
          </div>

          {configType === "boolean" && (
            <div className="mb-4">
              <Controller
                name={`configs.${index}.default`}
                control={control}
                render={({ field }) => (
                  <DefaultValueInput config_type={configType} field={field} />
                )}
              />
            </div>
          )}

          <div className="mt-2 mb-4 flex flex-col items-center gap-2 md:flex-row">
            <div className="flex grow flex-col items-start gap-1 md:flex-row md:gap-2">
              <div>
                <Controller
                  name={`configs.${index}.required`}
                  control={control}
                  render={({ field }) => (
                    <Tooltip title="When checked, this field cannot be left empty during creation or updates.">
                      <FormControlLabel
                        control={<Checkbox {...field} checked={field.value} />}
                        label={<p className="m-0 text-body2">Required</p>}
                      />
                    </Tooltip>
                  )}
                />
              </div>
              <div>
                <Controller
                  name={`configs.${index}.frozen`}
                  control={control}
                  render={({ field }) => (
                    <Tooltip title="When checked, the value of this field cannot be changed after the initial creation.">
                      <FormControlLabel
                        control={<Checkbox {...field} checked={field.value} />}
                        label={<p className="m-0 text-body2">Frozen</p>}
                      />
                    </Tooltip>
                  )}
                />
              </div>
              <div>
                <Controller
                  name={`configs.${index}.unique`}
                  control={control}
                  render={({ field }) => (
                    <Tooltip title="When checked, this field must have a unique value across all instances.">
                      <FormControlLabel
                        control={<Checkbox {...field} checked={field.value} />}
                        label={<p className="m-0 text-body2">Unique</p>}
                      />
                    </Tooltip>
                  )}
                />
              </div>
              <div>
                <Controller
                  name={`configs.${index}.restricted`}
                  control={control}
                  render={({ field }) => (
                    <Tooltip title="When checked, this field will be hidden during creation, default value should be provided.">
                      <FormControlLabel
                        control={<Checkbox {...field} checked={field.value} />}
                        label={<p className="m-0 text-body2">Restricted</p>}
                      />
                    </Tooltip>
                  )}
                />
              </div>
            </div>
            <ConfigReferenceInput control={control} index={index} />
          </div>

          {configType === "string" && (
            <Accordion
              standalone
              className="mt-2"
              expanded={isStringValidationOpen}
              onChange={(_, expanded) => setIsStringValidationOpen(expanded)}
              square
            >
              <AccordionSummary>
                <div className="flex w-full items-center justify-between gap-4">
                  <h6 className="m-0 text-subtitle2 font-semibold text-grey-500">
                    String Validation
                  </h6>
                  <Controller
                    name={validationEnabledField}
                    control={control}
                    defaultValue={false}
                    render={({ field }) => (
                      <FormControlLabel
                        className="m-0"
                        labelPlacement="start"
                        onClick={(event) => event.stopPropagation()}
                        onFocus={(event) => event.stopPropagation()}
                        label={
                          <span className="text-caption text-fg-muted">
                            {field.value ? "Enabled" : "Disabled"}
                          </span>
                        }
                        control={
                          <Switch
                            ref={field.ref}
                            name={field.name}
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
                </div>
              </AccordionSummary>
              <AccordionDetails>
                {validationEnabled ? (
                  <ValidationRegexControls control={control} index={index} />
                ) : (
                  <p className="m-0 text-body2 text-fg-muted">
                    Validation is disabled for this variable. Toggle the switch
                    to enable it.
                  </p>
                )}
              </AccordionDetails>
            </Accordion>
          )}
          {configType === "number" && (
            <Accordion
              standalone
              className="mt-2"
              expanded={isNumberValidationOpen}
              onChange={(_, expanded) => setIsNumberValidationOpen(expanded)}
              square
            >
              <AccordionSummary>
                <div className="flex w-full items-center justify-between gap-4">
                  <h6 className="m-0 text-subtitle2 font-semibold text-grey-500">
                    Number Validation
                  </h6>
                  <Controller
                    name={validationEnabledField}
                    control={control}
                    defaultValue={false}
                    render={({ field }) => (
                      <FormControlLabel
                        className="m-0"
                        labelPlacement="start"
                        onClick={(event) => event.stopPropagation()}
                        onFocus={(event) => event.stopPropagation()}
                        label={
                          <span className="text-caption text-fg-muted">
                            {field.value ? "Enabled" : "Disabled"}
                          </span>
                        }
                        control={
                          <Switch
                            ref={field.ref}
                            name={field.name}
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
                </div>
              </AccordionSummary>
              <AccordionDetails>
                {validationEnabled ? (
                  <ValidationNumberControls control={control} index={index} />
                ) : (
                  <p className="m-0 text-body2 text-fg-muted">
                    Validation is disabled for this variable. Toggle the switch
                    to enable numeric boundaries.
                  </p>
                )}
              </AccordionDetails>
            </Accordion>
          )}
        </div>
      )}
    </div>
  );
};
