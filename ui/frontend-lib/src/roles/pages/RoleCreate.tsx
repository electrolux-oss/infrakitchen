import { useState, useCallback, useEffect, SyntheticEvent } from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { useNavigate } from "react-router";

import { Box, TextField, Button, Autocomplete } from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { RoleCreate, User } from "../types";

const RoleCreatePageInner = () => {
  const { ikApi, linkPrefix } = useConfig();
  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useFormContext<RoleCreate>();

  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}roles`);

  const handleSave = useCallback(
    (data: RoleCreate) => {
      ikApi
        .postRaw("permissions", data)
        .then((response: { id: string }) => {
          if (response.id) {
            notify(`Role created successfully: ${data.role}`, "success");
            return response;
          }
        })
        .catch((error: any) => {
          notifyError(error);
        });
    },
    [ikApi],
  );

  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    ikApi
      .get("users")
      .then((response) => {
        setUsers(response);
      })
      .catch((error: any) => {
        notifyError(error);
      });
  }, [ikApi]);

  return (
    <PageContainer
      title="Create Role"
      onBack={handleBack}
      backAriaLabel="Back to roles"
      bottomActions={
        <>
          <Button variant="outlined" color="primary" onClick={handleBack}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(handleSave)}
          >
            Save
          </Button>
        </>
      }
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          width: "75%",
          minWidth: 320,
          maxWidth: 1000,
        }}
      >
        <PropertyCard title="Role Details">
          <Box>
            <Controller
              name="role"
              control={control}
              rules={{ required: "Role name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Role Name"
                  variant="outlined"
                  error={!!errors.role}
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Role name",
                    },
                  }}
                />
              )}
            />
            <Controller
              name="user_id"
              control={control}
              rules={{ required: "User is required" }}
              render={({ field }) => (
                <Autocomplete
                  {...field}
                  id="user-autocomplete"
                  options={users}
                  getOptionLabel={(u: User) => u.identifier}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={users.find((u) => u.id === field.value) || null}
                  onChange={(
                    _event: SyntheticEvent,
                    selectedUser: User | null,
                  ) => {
                    field.onChange(selectedUser ? selectedUser.id : "");
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="User name"
                      variant="outlined"
                      error={!!errors.user_id}
                      helperText={
                        errors.user_id
                          ? errors.user_id.message
                          : "Select user to assign this role"
                      }
                      fullWidth
                      margin="normal"
                    />
                  )}
                />
              )}
            />
          </Box>
        </PropertyCard>
      </Box>
    </PageContainer>
  );
};

const RoleCreatePage = () => {
  const form = useForm<RoleCreate>({
    defaultValues: {
      casbin_type: "user_role",
      role: "",
      user_id: "",
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...form}>
      <RoleCreatePageInner />
    </FormProvider>
  );
};

RoleCreatePage.path = "/roles/create";

export { RoleCreatePage };
