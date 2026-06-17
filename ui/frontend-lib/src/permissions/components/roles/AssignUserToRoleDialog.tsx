import { useCallback, useId, useState } from "react";

import { Controller, useForm } from "react-hook-form";

import { Box, Button } from "@mui/material";

import { CommonDialog } from "../../../common";
import ReferenceSearchInput from "../../../common/components/inputs/ReferenceSearchInput";
import { useConfig } from "../../../common/context/ConfigContext";
import { notify, notifyError } from "../../../common/hooks/useNotification";
import { IkEntity } from "../../../types";
import { ASSIGN_USER_TO_ROLE_MUTATION } from "../../graphql/mutations";

interface RoleCreateProps {
  userId?: string;
  roleName?: string;
  onClose?: () => void;
  formId?: string;
}

interface FormValues {
  role: string;
  userId: string;
}

export const AssignUserToRole = (props: RoleCreateProps) => {
  const { userId, roleName, onClose, formId } = props;
  const { ikApi } = useConfig();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      role: roleName || "",
      userId: userId || "",
    },
  });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const onSubmit = useCallback(
    (data: any) => {
      if (!data["role"] || !data["userId"]) {
        notifyError(new Error("Both Role and User must be selected."));
        return;
      }
      ikApi
        .graphqlRequest<{ assignUserToRole: { id: string } }>(
          ASSIGN_USER_TO_ROLE_MUTATION,
          {
            roleId: data["role"],
            userId: data["userId"],
          },
        )
        .then((response) => {
          if (response.assignUserToRole.id) {
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

  const generatedFormId = useId();
  const resolvedFormId = formId ?? generatedFormId;

  return (
    <Box sx={{ width: "50%" }}>
      <form id={resolvedFormId} onSubmit={handleSubmit(onSubmit)}>
        {userId && (
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
              />
            )}
          />
        )}
        {roleName && (
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
              />
            )}
          />
        )}
      </form>
    </Box>
  );
};

interface UserRoleCreateProps {
  userId?: string;
  roleName?: string;
  open: boolean;
  onClose: () => void;
}

export const UserRoleCreateDialog = (props: UserRoleCreateProps) => {
  const { userId, roleName, onClose, open } = props;
  const formId = useId();

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Assign User Role"
      actions={
        <Button type="submit" form={formId} variant="contained">
          Submit
        </Button>
      }
      content={
        <AssignUserToRole
          userId={userId}
          roleName={roleName}
          onClose={onClose}
          formId={formId}
        />
      }
    />
  );
};
