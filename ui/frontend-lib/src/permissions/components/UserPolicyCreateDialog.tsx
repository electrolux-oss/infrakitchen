import React, { useCallback, useState } from "react";

import { Controller, useForm } from "react-hook-form";

import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";

import { CommonDialog } from "../../common/components/CommonDialog";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { IkEntity } from "../../types";

interface UserPolicyCreateContentProps {
  user_id: string;
  onClose?: () => void;
  onSubmit: (data: any) => void;
  control: any;
  errors: any;
  buffer: Record<string, IkEntity | IkEntity[]>;
  setBuffer: React.Dispatch<
    React.SetStateAction<Record<string, IkEntity | IkEntity[]>>
  >;
}

const actions = [
  { id: "read", name: "Read" },
  { id: "write", name: "Write" },
  { id: "admin", name: "Admin" },
];

export const UserPolicyCreateContent = (
  props: UserPolicyCreateContentProps,
) => {
  const { control, errors, buffer, setBuffer } = props;
  const { ikApi } = useConfig();

  return (
    <>
      <Controller
        name="resource"
        control={control}
        rules={{ required: "*Required" }}
        render={({ field }) => (
          <ReferenceInput
            {...field}
            ikApi={ikApi}
            entity_name="resources"
            buffer={buffer}
            setBuffer={setBuffer}
            error={!!errors.resource}
            helpertext={errors.resource ? errors.resource.message : ""}
            value={field.value}
            label="Select Resource"
          />
        )}
      />
      <Controller
        name="action"
        control={control}
        rules={{ required: "Action is required" }}
        render={({ field, fieldState }) => (
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="action-label">Action name</InputLabel>
            <Select
              error={!!fieldState.error}
              labelId="action-label"
              {...field}
            >
              {actions.map((e) => (
                <MenuItem key={e.id} value={e.id}>
                  {e.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      />
    </>
  );
};

interface UserPolicyCreateDialogProps {
  user_id: string;
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  casbin_type: string;
  resource: string | undefined;
  action: string;
  user_id: string;
}

export const UserPolicyCreateDialog = (props: UserPolicyCreateDialogProps) => {
  const { user_id, onClose, open } = props;
  const { ikApi } = useConfig();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      casbin_type: "resource_user_policy",
      resource: "",
      action: "read",
      user_id: user_id,
    },
  });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const onSubmit = useCallback(
    (data: any) => {
      ikApi
        .postRaw("permissions", data)
        .then((response: { id: string }) => {
          if (response.id) {
            notify(`Policy assigned successfully`, "success");
            onClose?.();

            return response;
          }
        })
        .catch((error: any) => {
          notifyError(error);
        });
    },
    [ikApi, onClose],
  );

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Assign Resource Policy"
      content={
        <UserPolicyCreateContent
          user_id={user_id}
          onClose={onClose}
          onSubmit={onSubmit}
          control={control}
          errors={errors}
          buffer={buffer}
          setBuffer={setBuffer}
        />
      }
      actions={
        <Button variant="contained" onClick={handleSubmit(onSubmit)}>
          Assign Policy
        </Button>
      }
    />
  );
};
