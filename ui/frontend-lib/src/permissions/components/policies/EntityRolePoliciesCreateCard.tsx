import { useCallback, useId, useState } from "react";

import { Controller, useForm } from "react-hook-form";

import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import ReferenceSearchInput from "../../../common/components/inputs/ReferenceSearchInput";
import { useConfig } from "../../../common/context/ConfigContext";
import { notify, notifyError } from "../../../common/hooks/useNotification";
import { IkEntity } from "../../../types";
import { CREATE_ENTITY_POLICY_MUTATION } from "../../graphql";
import { EntityPolicyCreate } from "../../types";

interface EntityRolePolicyCreateProps {
  entityId?: string;
  entityName?: string;
  roleName?: string;
  onClose?: () => void;
  onSuccess?: () => void;
  formId?: string;
}

const actions = [
  { id: "read", name: "Read" },
  { id: "write", name: "Write" },
  { id: "admin", name: "Admin" },
];

export const EntityRolePolicyCreateCard = (
  props: EntityRolePolicyCreateProps,
) => {
  const {
    roleName,
    entityId,
    entityName = "resource",
    onClose,
    onSuccess,
    formId,
  } = props;
  const { ikApi } = useConfig();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EntityPolicyCreate>({
    mode: "onChange",
    defaultValues: {
      role: roleName,
      entityId: entityId,
      entityName: entityName,
      action: "read",
      inheritsChildren: false,
    },
  });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  // Store the selected role entity to access v1 field reliably
  const [selectedRole, setSelectedRole] = useState<IkEntity | null>(null);

  const generatedFormId = useId();
  const resolvedFormId = formId ?? generatedFormId;

  const onSubmit = useCallback(
    async (data: EntityPolicyCreate) => {
      try {
        if (!data.entityId) {
          notifyError(new Error("Resource is required for resource policy."));
          return;
        }
        if (!data.action) {
          notifyError(new Error("Action is required for resource policy."));
          return;
        }

        // Build payload, using selectedRole.v1 if role was selected from dropdown
        const response = await ikApi.graphqlRequest<{
          createEntityPolicy: { id: string; v1: string; v2: string };
        }>(CREATE_ENTITY_POLICY_MUTATION, {
          input: {
            ...data,
            role: roleName || selectedRole?.v1 || data.role,
          },
        });
        const responseData = response.createEntityPolicy;
        if (responseData.id) {
          notify(`Resource policy created successfully`, "success");
          onSuccess?.();
          onClose?.();
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, onClose, onSuccess, roleName, selectedRole],
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 600, mx: "auto" }}>
      <form id={resolvedFormId} onSubmit={handleSubmit(onSubmit)}>
        {!roleName && (
          <Controller
            name="role"
            control={control}
            rules={{ required: "Role is required" }}
            render={({ field }) => (
              <ReferenceSearchInput
                {...field}
                onChange={(value: any) => {
                  field.onChange(value);
                  // Store the full selected entity to access v1 reliably
                  if (value && buffer["permissions/roles"]) {
                    const selected = (
                      buffer["permissions/roles"] as IkEntity[]
                    ).find((r) => r.id === value);
                    setSelectedRole(selected || null);
                  } else {
                    setSelectedRole(null);
                  }
                }}
                ikApi={ikApi}
                entity_name="permissions/roles"
                showFields={["v1"]}
                searchField="v1"
                error={!!errors.role}
                helpertext={errors.role ? errors.role.message : ""}
                buffer={buffer}
                setBuffer={setBuffer}
                value={field.value}
                label="Select Role"
                sx={{ mb: 3 }}
              />
            )}
          />
        )}
        {!entityId && (
          <Controller
            name="entityId"
            control={control}
            rules={{ required: `${entityName} is required.` }}
            render={({ field }) => (
              <ReferenceSearchInput
                {...field}
                ikApi={ikApi}
                entity_name="resources"
                searchField="name"
                showFields={["template.name", "name"]}
                buffer={buffer}
                setBuffer={setBuffer}
                error={!!errors.entityId}
                helpertext={errors.entityId ? errors.entityId.message : ""}
                value={field.value}
                label="Select Resource"
                sx={{ mb: 3 }}
              />
            )}
          />
        )}

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
        {entityId && !roleName && entityName !== "integration" && (
          <Controller
            name="inheritsChildren"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox {...field} checked={field.value} />}
                label="Inherit to Child Resources"
              />
            )}
          />
        )}
      </form>
    </Box>
  );
};
