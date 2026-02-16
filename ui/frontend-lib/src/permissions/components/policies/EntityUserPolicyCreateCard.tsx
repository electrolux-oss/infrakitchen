import { useCallback, useId, useState } from "react";

import { Controller, useForm } from "react-hook-form";

import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import ReferenceSearchInput from "../../../common/components/inputs/ReferenceSearchInput";
import { useConfig } from "../../../common/context/ConfigContext";
import { notify, notifyError } from "../../../common/hooks/useNotification";
import { IkEntity } from "../../../types";
import { EntityPolicyCreate } from "../../types";

interface EntityUserPolicyCreateCardProps {
  user_id?: string;
  entity_name?: string;
  entity_id?: string;
  onClose?: () => void;
  formId?: string;
}

const actions = [
  { id: "read", name: "Read" },
  { id: "write", name: "Write" },
  { id: "admin", name: "Admin" },
];

export const EntityUserPolicyCreateCard = (
  props: EntityUserPolicyCreateCardProps,
) => {
  const {
    user_id,
    entity_name = "resource",
    entity_id,
    onClose,
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
      entity_name: entity_name,
      entity_id: entity_id,
      action: "read",
      user_id: user_id,
    },
  });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const generatedFormId = useId();
  const resolvedFormId = formId ?? generatedFormId;

  const onSubmit = useCallback(
    async (data: EntityPolicyCreate) => {
      try {
        if (!data.entity_id) {
          notifyError(new Error("Resource is required for resource policy."));
          return;
        }
        if (!data.action) {
          notifyError(new Error("Action is required for resource policy."));
          return;
        }
        const response = await ikApi.postRaw("permissions/policy/entity", data);
        if (response.id) {
          notify(
            `Resource policy created successfully: ${response.v1} - ${response.v2}`,
            "success",
          );
          onClose?.();
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, onClose],
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 600, mx: "auto", mt: 4, p: 2 }}>
      <form id={resolvedFormId} onSubmit={handleSubmit(onSubmit)}>
        {!entity_id && (
          <Controller
            name="entity_id"
            control={control}
            rules={{ required: "Resource is required" }}
            render={({ field }) => (
              <ReferenceSearchInput
                {...field}
                ikApi={ikApi}
                entity_name={`${entity_name}s`}
                searchField="name"
                showFields={["template.name", "name"]}
                buffer={buffer}
                setBuffer={setBuffer}
                error={!!errors.entity_id}
                helpertext={errors.entity_id ? errors.entity_id.message : ""}
                value={field.value}
                label="Select Resource"
                sx={{ mb: 3 }}
              />
            )}
          />
        )}
        {!user_id && (
          <Controller
            name="user_id"
            control={control}
            render={({ field }) => (
              <ReferenceSearchInput
                {...field}
                ikApi={ikApi}
                entity_name="users"
                showFields={["identifier", "provider"]}
                searchField="identifier"
                error={!!errors.user_id}
                helpertext={errors.user_id ? errors.user_id.message : ""}
                buffer={buffer}
                setBuffer={setBuffer}
                value={field.value}
                label="Select User"
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
      </form>
    </Box>
  );
};
