import { useCallback, useState } from "react";

import { Controller, useForm } from "react-hook-form";

import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from "@mui/material";

import { DialogSlider } from "../../common/components/DialogSlider";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { IkEntity } from "../../types";

interface PolicyCreateProps {
  user_id: string;
  onClose?: () => void;
}

interface FormValues {
  casbin_type: string;
  resource: string | undefined;
  action: string;
  user_id: string;
}

const actions = [
  { id: "read", name: "Read" },
  { id: "write", name: "Write" },
  { id: "admin", name: "Admin" },
];

export const UserPolicyCreate = (props: PolicyCreateProps) => {
  const { user_id, onClose } = props;
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
            notify(`Role created successfully: ${data.role}`, "success");
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
            <FormControl fullWidth>
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

interface UserPolicyCreateProps {
  user_id: string;
  open: boolean;
  onClose: () => void;
}

export const UserPolicyCreateDialog = (props: UserPolicyCreateProps) => {
  const { user_id, onClose, open } = props;

  return (
    <DialogSlider open={open} onClose={onClose} title="Assign Resource Policy">
      <UserPolicyCreate user_id={user_id} onClose={onClose} />
    </DialogSlider>
  );
};
