import { useCallback, useState } from "react";

import { Controller, useForm } from "react-hook-form";

import { Box, Button } from "@mui/material";

import { CommonDialog } from "../../../common";
import ReferenceSearchInput from "../../../common/components/inputs/ReferenceSearchInput";
import { useConfig } from "../../../common/context/ConfigContext";
import { notify, notifyError } from "../../../common/hooks/useNotification";
import { IkEntity } from "../../../types";

interface RoleCreateProps {
  user_id?: string;
  role_name?: string;
  onClose?: () => void;
}

interface FormValues {
  role: string;
  user_id: string;
}

export const AssignUserToRole = (props: RoleCreateProps) => {
  const { user_id, role_name, onClose } = props;
  const { ikApi } = useConfig();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      role: role_name || "",
      user_id: user_id || "",
    },
  });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const onSubmit = useCallback(
    (data: any) => {
      if (!data["role"] || !data["user_id"]) {
        notifyError(new Error("Both Role and User must be selected."));
        return;
      }
      ikApi
        .postRaw(`permissions/role/${data["role"]}/${data["user_id"]}`, {})
        .then((response: { id: string }) => {
          if (response.id) {
            notify(`Role assigned successfully`, "success");
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
    <Box sx={{ width: "50%", mt: 4 }}>
      <form>
        {user_id && (
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <ReferenceSearchInput
                {...field}
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
        {role_name && (
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
        <Button
          type="submit"
          variant="contained"
          onClick={handleSubmit(onSubmit)}
        >
          Submit
        </Button>
      </form>
    </Box>
  );
};

interface UserRoleCreateProps {
  user_id?: string;
  role_name?: string;
  open: boolean;
  onClose: () => void;
}

export const UserRoleCreateDialog = (props: UserRoleCreateProps) => {
  const { user_id, role_name, onClose, open } = props;

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Assign User Role"
      content={
        <AssignUserToRole
          user_id={user_id}
          role_name={role_name}
          onClose={onClose}
        />
      }
    />
  );
};
