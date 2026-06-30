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
import { CREATE_ENTITY_POLICY_MUTATION } from "../../graphql";
import { EntityPolicyCreate } from "../../types";

interface EntityUserPolicyCreateCardProps {
  userId?: string;
  entityName?: string;
  entityId?: string;
  onClose?: () => void;
  onSuccess?: () => void;
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
    userId,
    entityName = "resource",
    entityId,
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
      entityName: entityName,
      entityId: entityId,
      action: "read",
      userId: userId,
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
        if (!data.entityId) {
          notifyError(new Error("Resource is required for resource policy."));
          return;
        }
        if (!data.action) {
          notifyError(new Error("Action is required for resource policy."));
          return;
        }
        const response = await ikApi.graphqlRequest<{
          createEntityPolicy: { id: string; v1: string; v2: string };
        }>(CREATE_ENTITY_POLICY_MUTATION, { input: data });
        if (response.createEntityPolicy.id) {
          notify(
            `Resource policy created successfully: ${response.createEntityPolicy.v1} - ${response.createEntityPolicy.v2}`,
            "success",
          );
          onSuccess?.();
          onClose?.();
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, onClose, onSuccess],
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 600, mx: "auto" }}>
      <form id={resolvedFormId} onSubmit={handleSubmit(onSubmit)}>
        {!entityId && (
          <Controller
            name="entityId"
            control={control}
            rules={{ required: "Resource is required" }}
            render={({ field }) => (
              <ReferenceSearchInput
                {...field}
                ikApi={ikApi}
                entity_name={`${entityName}s`}
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
        {!userId && (
          <Controller
            name="userId"
            control={control}
            render={({ field }) => (
              <ReferenceSearchInput
                {...field}
                ikApi={ikApi}
                entity_name="users"
                showFields={["identifier", "provider"]}
                searchField="identifier"
                error={!!errors.userId}
                helpertext={errors.userId ? errors.userId.message : ""}
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
