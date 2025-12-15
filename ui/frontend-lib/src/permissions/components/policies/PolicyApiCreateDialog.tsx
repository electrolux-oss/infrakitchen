import { useCallback, useEffect, useState } from "react";

import { Controller, useForm } from "react-hook-form";

import {
  Box,
  Button,
  FormControl,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Typography,
  RadioGroup,
  Radio,
} from "@mui/material";

import { CommonDialog } from "../../../common";
import { useConfig } from "../../../common/context/ConfigContext";
import { notify, notifyError } from "../../../common/hooks/useNotification";
import { ApiPolicyCreate } from "../../types";

interface PolicyApiCreateProps {
  role_name: string;
  onClose?: () => void;
}

const actions = [
  { id: "read", name: "Read" },
  { id: "write", name: "Write" },
  { id: "admin", name: "Admin" },
];

export const PolicyApiCreate = (props: PolicyApiCreateProps) => {
  const { role_name, onClose } = props;
  const { ikApi } = useConfig();
  const { control, handleSubmit } = useForm<ApiPolicyCreate>({
    mode: "onChange",
    defaultValues: {
      action: "read",
      role: role_name,
      selectedApiPermissions: [],
    },
  });

  const [entities, setEntities] = useState<string[]>([]);

  useEffect(() => {
    ikApi
      .get("entities")
      .then((data: string[]) => {
        setEntities(data);
      })
      .catch((error: any) => {
        notifyError(error);
      });
  }, [ikApi]);

  const onSubmit = useCallback(
    async (data: ApiPolicyCreate) => {
      try {
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
            ikApi.postRaw("permissions/policy/api", {
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
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, onClose],
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 600, mx: "auto", mt: 4, p: 2 }}>
      <form onSubmit={handleSubmit(onSubmit)}>
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
                (p) => {
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
                      (p) => p.api === apiName,
                    );
                    const selectedActionsForApi =
                      currentSelectedApiPermissions?.find(
                        (p) => p.api === apiName,
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
        <Button
          type="submit"
          variant="contained"
          color="primary"
          sx={{ mt: 2, py: 1.5, px: 4, borderRadius: "8px" }}
        >
          Submit
        </Button>
      </form>
    </Box>
  );
};

interface PolicyApiCreateDialogProps {
  role_name: string;
  open: boolean;
  onClose: () => void;
}

export const PolicyApiCreateDialog = (props: PolicyApiCreateDialogProps) => {
  const { role_name, onClose, open } = props;

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Assign Resource Policy"
      content={<PolicyApiCreate role_name={role_name} onClose={onClose} />}
    />
  );
};
