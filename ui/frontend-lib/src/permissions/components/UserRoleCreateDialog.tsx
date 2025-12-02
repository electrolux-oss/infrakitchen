import { SyntheticEvent, useCallback, useEffect, useState } from "react";

import { Controller, useForm } from "react-hook-form";

import { TextField, Button, Autocomplete } from "@mui/material";

import { CommonDialog } from "../../common/components/CommonDialog";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";

interface UserRoleCreateContentProps {
  user_id: string;
  onClose?: () => void;
  onSubmit: (data: any) => void;
  control: any;
  errors: any;
}

export const UserRoleCreateContent = (props: UserRoleCreateContentProps) => {
  const { control, errors } = props;
  const { ikApi } = useConfig();

  const [allRoles, setAllRoles] = useState<string[]>([]);

  useEffect(() => {
    ikApi
      .get("permissions/roles")
      .then((response) => {
        setAllRoles(response);
      })
      .catch((error: any) => {
        notifyError(error);
      });
  }, [ikApi]);

  return (
    <Controller
      name="role"
      control={control}
      render={({ field }) => (
        <Autocomplete
          {...field}
          id="role-autocomplete"
          freeSolo
          options={allRoles}
          onChange={(_event: SyntheticEvent, newValue: string | null) => {
            field.onChange(newValue || "");
          }}
          onInputChange={(_event: SyntheticEvent, newInputValue: string) => {
            field.onChange(newInputValue);
          }}
          value={field.value || null}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Role name"
              variant="outlined"
              error={!!errors.role}
              helperText={
                errors.role
                  ? errors.role.message
                  : "Select an existing role or type a new one to create it"
              }
              fullWidth
              margin="normal"
            />
          )}
        />
      )}
    />
  );
};

interface UserRoleCreateDialogProps {
  user_id: string;
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  casbin_type: string;
  role: string;
  user_id: string;
}

export const UserRoleCreateDialog = (props: UserRoleCreateDialogProps) => {
  const { user_id, onClose, open } = props;
  const { ikApi } = useConfig();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      casbin_type: "user_role",
      role: "",
      user_id: user_id,
    },
  });

  const onSubmit = useCallback(
    (data: any) => {
      ikApi
        .postRaw("permissions", data)
        .then((response: { id: string }) => {
          if (response.id) {
            notify(`Role assigned successfully: ${data.role}`, "success");
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
      title="Assign User Role"
      content={
        <UserRoleCreateContent
          user_id={user_id}
          onClose={onClose}
          onSubmit={onSubmit}
          control={control}
          errors={errors}
        />
      }
      actions={
        <Button variant="contained" onClick={handleSubmit(onSubmit)}>
          Assign Role
        </Button>
      }
    />
  );
};
