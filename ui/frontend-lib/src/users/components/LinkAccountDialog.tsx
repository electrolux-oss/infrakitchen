import { useCallback, useState } from "react";

import { Controller, useForm } from "react-hook-form";

import { Box, Button } from "@mui/material";

import { CommonDialog, useConfig } from "../../common";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { IkEntity } from "../../types";
import { UserResponse } from "../types";

interface PolicyCreateProps {
  primary_account?: string;
  secondary_account?: string;
  onClose?: () => void;
  onSubmit: (data: any) => void;
  control: any;
  errors: any;
  handleSubmit: any;
}

interface FormValues {
  primary_account?: string;
  secondary_account?: string;
}

export const LinkUserAccount = (props: PolicyCreateProps) => {
  const { control, errors } = props;
  const { ikApi } = useConfig();

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  return (
    <Box sx={{ width: "100%" }}>
      <form>
        <Controller
          name="secondary_account"
          control={control}
          rules={{ required: "*Required" }}
          render={({ field }) => (
            <ReferenceInput
              {...field}
              ikApi={ikApi}
              entity_name="users"
              buffer={buffer}
              setBuffer={setBuffer}
              filter={{
                is_primary: false,
                deactivated: false,
              }}
              error={!!errors.secondary_account}
              helpertext={
                errors.secondary_account ? errors.secondary_account.message : ""
              }
              value={field.value}
              label="Select Secondary Account"
              required
            />
          )}
        />
      </form>
    </Box>
  );
};

interface AddPrimaryAccountProps {
  primary_account?: string;
  secondary_account?: string;
  open: boolean;
  onClose: () => void;
}

export const LinkUserDialog = (props: AddPrimaryAccountProps) => {
  const { onClose, open, primary_account, secondary_account } = props;
  const { ikApi } = useConfig();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      primary_account: primary_account,
      secondary_account: secondary_account,
    },
  });

  const onSubmit = useCallback(
    (data: any) => {
      ikApi
        .postRaw(
          `users/${data.primary_account}/link/${data.secondary_account}`,
          {},
        )
        .then((response: UserResponse) => {
          if (response.id) {
            notify("User accounts linked successfully", "success");
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
      title="Link User Account"
      maxWidth="sm"
      content={
        <LinkUserAccount
          primary_account={primary_account}
          secondary_account={secondary_account}
          onClose={onClose}
          onSubmit={onSubmit}
          control={control}
          errors={errors}
          handleSubmit={handleSubmit}
        />
      }
      actions={
        <Button variant="contained" onClick={handleSubmit(onSubmit)}>
          Link Account
        </Button>
      }
    />
  );
};
