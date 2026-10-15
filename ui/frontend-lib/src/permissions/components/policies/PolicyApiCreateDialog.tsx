import { useCallback } from "react";

import { Controller, useForm } from "react-hook-form";

import { CommonDialog } from "../../../common";
import { useConfig } from "../../../common/context/ConfigContext";
import { notify, notifyError } from "../../../common/hooks/useNotification";
import {
  Checkbox,
  FormControlLabel,
  Button,
  FormControl,
  RadioGroup,
  Radio,
} from "../../../ui";
import { CREATE_API_POLICY_MUTATION } from "../../graphql/mutations";
import { ApiPolicyCreate } from "../../types";

interface PolicyApiCreateProps {
  role_name: string;
  onClose?: () => void;
  onSuccess?: () => void;
}

const actions = [
  { id: "read", name: "Read" },
  { id: "write", name: "Write" },
  { id: "admin", name: "Admin" },
];

export const PolicyApiCreate = (props: PolicyApiCreateProps) => {
  const { role_name, onClose, onSuccess } = props;
  const { ikApi, globalConfig } = useConfig();
  const { control, handleSubmit } = useForm<ApiPolicyCreate>({
    mode: "onChange",
    defaultValues: {
      action: "read",
      role: role_name,
      selectedApiPermissions: [],
    },
  });

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
            ikApi.graphqlRequest<{ createApiPolicy: { id: string } }>(
              CREATE_API_POLICY_MUTATION,
              {
                input: {
                  role: data.role,
                  api: apiPerm.api,
                  action: action,
                },
              },
            ),
          );
        }
        await Promise.all(promises);
        notify(
          `API policies created successfully for role: ${data.role}`,
          "success",
        );
        onSuccess?.();
        onClose?.();
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, onClose, onSuccess],
  );

  return (
    <div className="mx-auto w-full max-w-150">
      <form id="policy-api-create-form" onSubmit={handleSubmit(onSubmit)}>
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
              <div className="mt-4 mb-6">
                <p className="m-0 mb-2 text-body1">Select APIs and Actions:</p>
                <div className="flex flex-col flex-wrap">
                  {globalConfig.entities.length === 0 && (
                    <p className="m-0 text-body2 text-fg-muted">
                      No APIs available.
                    </p>
                  )}
                  {globalConfig.entities.map((apiName: string) => {
                    const isApiSelected = currentSelectedApiPermissions?.some(
                      (p) => p.api === apiName,
                    );
                    const selectedActionsForApi =
                      currentSelectedApiPermissions?.find(
                        (p) => p.api === apiName,
                      )?.actions || [];

                    return (
                      <div
                        className="mb-3 rounded-surface border border-divider bg-paper p-3"
                        key={apiName}
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
                            <p className="m-0 text-body1 font-medium">
                              {apiName}
                            </p>
                          }
                        />
                        {isApiSelected && (
                          <div className="mt-2 ml-6">
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
                                    control={<Radio value={action.id} />}
                                    label={action.name}
                                  />
                                ))}
                              </RadioGroup>
                            </FormControl>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {fieldState.error && (
                  <span className="text-caption text-error">
                    {fieldState.error.message}
                  </span>
                )}
              </div>
            );
          }}
        />
      </form>
    </div>
  );
};

interface PolicyApiCreateDialogProps {
  role_name: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PolicyApiCreateDialog = (props: PolicyApiCreateDialogProps) => {
  const { role_name, onClose, onSuccess, open } = props;

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Assign Resource Policy"
      content={
        <PolicyApiCreate
          role_name={role_name}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      }
      actions={
        <Button type="submit" form="policy-api-create-form" variant="contained">
          Submit
        </Button>
      }
    />
  );
};
