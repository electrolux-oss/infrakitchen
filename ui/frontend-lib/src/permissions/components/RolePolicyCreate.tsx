import { useCallback, useEffect, useState } from "react";

import { Controller, useForm } from "react-hook-form";

import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Typography,
  RadioGroup,
  Radio,
} from "@mui/material";

import { CommonDialog } from "../../common/components/CommonDialog";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { IkEntity } from "../../types";

interface PolicyCreateProps {
  role_name: string;
  onClose?: () => void;
  onSubmit: (data: FormValues) => void;
  control: any;
  errors: any;
  handleSubmit: any;
  watch: any;
  setValue: any;
}

interface FormValues {
  casbin_type: "resource_policy" | "api_policy";
  role: string;
  resource?: string;
  action?: string;

  // Field for api_policy
  selectedApiPermissions?: { api: string; actions: string[] }[];
}

const actions = [
  { id: "read", name: "Read" },
  { id: "write", name: "Write" },
  { id: "admin", name: "Admin" },
];

export const RolePolicyCreate = (props: PolicyCreateProps) => {
  const { onSubmit, control, errors, handleSubmit, watch, setValue } = props;
  const { ikApi } = useConfig();

  const watchedCasbinType = watch("casbin_type");
  const [roleType, setRoleType] = useState<string>();
  const [entities, setEntities] = useState<string[]>([]);

  const casbin_type_choices = [
    { id: "resource_policy", name: "Resource policy" },
    { id: "api_policy", name: "Api policy" },
  ];

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  useEffect(() => {
    setRoleType(watchedCasbinType);
    if (watchedCasbinType === "api_policy") {
      setValue("resource", undefined);
      setValue("action", undefined);
    } else {
      setValue("selectedApiPermissions", []);
      setValue("action", "read");
    }
  }, [watchedCasbinType, setValue]);

  useEffect(() => {
    if (roleType === "api_policy") {
      ikApi
        .get("entities")
        .then((data: string[]) => {
          setEntities(data);
        })
        .catch((error: any) => {
          notifyError(error);
        });
    }
  }, [roleType, ikApi]);

  return (
    <Box sx={{ mt: 2 }}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="casbin_type"
          control={control}
          rules={{ required: "Permission type is required" }}
          render={({ field, fieldState }) => (
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="permission-type-label">Policy Type</InputLabel>
              <Select
                error={!!fieldState.error}
                labelId="permission-type-label"
                label="Policy Type"
                {...field}
              >
                {casbin_type_choices.map((e) => (
                  <MenuItem key={e.id} value={e.id}>
                    {e.name}
                  </MenuItem>
                ))}
              </Select>
              {fieldState.error && (
                <Typography color="error" variant="caption">
                  {fieldState.error.message}
                </Typography>
              )}
            </FormControl>
          )}
        />

        {roleType === "api_policy" && (
          <Controller
            name="selectedApiPermissions"
            control={control}
            rules={{
              validate: (value) =>
                (value && value.length > 0) ||
                "At least one API permission is required.",
            }}
            render={({ field, fieldState }) => {
              const { value: currentSelectedApiPermissions, onChange } = field;

              const handleApiToggle = (apiName: string, isChecked: boolean) => {
                let updatedPermissions = [
                  ...(currentSelectedApiPermissions || []),
                ];
                if (isChecked) {
                  updatedPermissions.push({ api: apiName, actions: ["read"] });
                } else {
                  updatedPermissions = updatedPermissions.filter(
                    (p) => p.api !== apiName,
                  );
                }
                onChange(updatedPermissions);
              };

              const handleActionChange = (apiName: string, action: string) => {
                const updatedPermissions = currentSelectedApiPermissions?.map(
                  (p: { api: string; actions: string[] }) => {
                    if (p.api === apiName) {
                      return { ...p, actions: [action] };
                    }
                    return p;
                  },
                );
                onChange(updatedPermissions);
              };

              return (
                <Box sx={{ mt: 2, mb: 3 }}>
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    Select APIs and Actions:
                  </Typography>
                  <FormGroup>
                    {entities.length === 0 && (
                      <Typography variant="body2" color="textSecondary">
                        No APIs available.
                      </Typography>
                    )}
                    {entities.map((apiName) => {
                      const isApiSelected = currentSelectedApiPermissions?.some(
                        (p: { api: string; actions: string[] }) =>
                          p.api === apiName,
                      );
                      const selectedActionsForApi =
                        currentSelectedApiPermissions?.find(
                          (p: { api: string; actions: string[] }) =>
                            p.api === apiName,
                        )?.actions || [];

                      return (
                        <Box
                          key={apiName}
                          sx={{
                            mb: 1.5,
                            p: 1.5,
                            border: "1px solid #e0e0e0",
                            borderRadius: "8px",
                            bgcolor: "#f9f9f9",
                          }}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={isApiSelected}
                                onChange={(e) =>
                                  handleApiToggle(apiName, e.target.checked)
                                }
                              />
                            }
                            label={
                              <Typography variant="body1" fontWeight="medium">
                                {apiName}
                              </Typography>
                            }
                          />
                          {isApiSelected && (
                            <Box sx={{ ml: 3, mt: 1 }}>
                              <FormControl component="fieldset">
                                <RadioGroup
                                  row
                                  aria-label={`actions-for-${apiName}`}
                                  name={`actions-for-${apiName}`}
                                  value={selectedActionsForApi[0] || ""}
                                  onChange={(e) =>
                                    handleActionChange(apiName, e.target.value)
                                  }
                                >
                                  {actions.map((action) => (
                                    <FormControlLabel
                                      key={`${apiName}-${action.id}`}
                                      value={action.id}
                                      control={<Radio />}
                                      label={action.name}
                                    />
                                  ))}
                                </RadioGroup>
                              </FormControl>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </FormGroup>
                  {fieldState.error && (
                    <Typography color="error" variant="caption">
                      {fieldState.error.message}
                    </Typography>
                  )}
                </Box>
              );
            }}
          />
        )}

        {roleType === "resource_policy" && (
          <>
            <Controller
              name="resource"
              control={control}
              rules={{ required: "Resource is required" }}
              render={({ field }) => (
                <ReferenceInput
                  {...field}
                  ikApi={ikApi}
                  entity_name="resources"
                  showFields={["template.name", "name"]}
                  buffer={buffer}
                  setBuffer={setBuffer}
                  error={!!errors.resource}
                  helpertext={errors.resource ? errors.resource.message : ""}
                  value={field.value}
                  label="Select Resource"
                  sx={{ mb: 3 }}
                />
              )}
            />
            <Controller
              name="action"
              control={control}
              rules={{ required: "Action is required" }}
              render={({ field, fieldState }) => (
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel id="action-label">Action name</InputLabel>
                  <Select
                    error={!!fieldState.error}
                    labelId="action-label"
                    label="Action name"
                    {...field}
                  >
                    {actions.map((e) => (
                      <MenuItem key={e.id} value={e.id}>
                        {e.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {fieldState.error && (
                    <Typography color="error" variant="caption">
                      {fieldState.error.message}
                    </Typography>
                  )}
                </FormControl>
              )}
            />
          </>
        )}
      </form>
    </Box>
  );
};

interface RolePolicyCreateProps {
  role_name: string;
  open: boolean;
  onClose: () => void;
}

export const RolePolicyCreateDialog = (props: RolePolicyCreateProps) => {
  const { role_name, onClose, open } = props;
  const { ikApi } = useConfig();
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      casbin_type: "resource_policy",
      resource: "",
      action: "read",
      role: role_name,
      selectedApiPermissions: [],
    },
  });

  const onSubmit = useCallback(
    async (data: FormValues) => {
      try {
        if (data.casbin_type === "api_policy") {
          if (
            !data.selectedApiPermissions ||
            data.selectedApiPermissions.length === 0
          ) {
            notifyError(new Error("No API permissions selected."));
            return;
          }

          const promises = [];
          for (const apiPerm of data.selectedApiPermissions) {
            if (apiPerm.actions.length === 0) {
              notify(
                `No actions selected for API: ${apiPerm.api}. Skipping.`,
                "warning",
              );
              continue;
            }
            const action = apiPerm.actions[0];
            promises.push(
              ikApi.postRaw("permissions", {
                casbin_type: "api_policy",
                role: data.role,
                api: apiPerm.api,
                action: action,
              }),
            );
          }
          await Promise.all(promises);
          notify(
            `API policies created successfully for role: ${data.role}`,
            "success",
          );
          onClose?.();
        } else if (data.casbin_type === "resource_policy") {
          if (!data.resource) {
            notifyError(new Error("Resource is required for resource policy."));
            return;
          }
          if (!data.action) {
            notifyError(new Error("Action is required for resource policy."));
            return;
          }
          const response = await ikApi.postRaw("permissions", {
            casbin_type: data.casbin_type,
            role: data.role,
            resource: data.resource,
            action: data.action,
          });
          if (response.id) {
            notify(
              `Resource policy created successfully: ${response.role}`,
              "success",
            );
            onClose?.();
          }
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, onClose],
  );

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Assign Resource Policy"
      content={
        <RolePolicyCreate
          role_name={role_name}
          onClose={onClose}
          onSubmit={onSubmit}
          control={control}
          errors={errors}
          handleSubmit={handleSubmit}
          watch={watch}
          setValue={setValue}
        />
      }
      actions={
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit(onSubmit)}
        >
          Submit
        </Button>
      }
    />
  );
};
