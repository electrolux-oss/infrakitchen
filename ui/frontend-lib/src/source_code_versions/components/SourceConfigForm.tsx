import { Controller, Control, useWatch, useFormState } from "react-hook-form";

import {
  TextField,
  Autocomplete,
  Chip,
  Checkbox,
  FormControlLabel,
  Typography,
  Box,
  Stack,
} from "@mui/material";

import { OverviewCard } from "../../common/components/OverviewCard";
import { SourceCodeVersionResponse } from "../types";

import { DefaultValueInput } from "./ConfigInputs";
import { ConfigReferenceInput } from "./ConfigReferenceInput";

export const SourceConfigForm = (props: {
  control: Control<any>;
  index: number;
  fieldId: string;
  source_code_version_id: string;
  source_code_versions: SourceCodeVersionResponse[];
}) => {
  const { control, index, source_code_versions } = props;

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
  const configReference = useWatch({
    control,
    name: `configs.${index}.reference`,
  });

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
              </Box>
            </Box>
          }
          description={configDescription}
        >
          <Box sx={{ flexGrow: 1, p: 2 }}>
            <Stack direction="column" spacing={1} sx={{ mb: 1 }}>
              {configType !== "boolean" && (
                <Box>
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
                    <DefaultValueInput config_type={configType} field={field} />
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
                      <FormControlLabel
                        control={<Checkbox {...field} checked={field.value} />}
                        label="Required"
                      />
                    )}
                  />
                </Box>
                <Box>
                  <Controller
                    name={`configs.${index}.frozen`}
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Checkbox {...field} checked={field.value} />}
                        label="Frozen"
                      />
                    )}
                  />
                </Box>
                <Box>
                  <Controller
                    name={`configs.${index}.unique`}
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Checkbox {...field} checked={field.value} />}
                        label="Unique"
                      />
                    )}
                  />
                </Box>
              </Stack>
              <Controller
                name={`configs.${index}.reference_id`}
                control={control}
                render={({ field }) => (
                  <ConfigReferenceInput
                    field={field}
                    sourceCodeVersions={source_code_versions}
                    reference={configReference}
                  />
                )}
              />
            </Stack>
          </Box>
        </OverviewCard>
      </Box>
    </Box>
  );
};
