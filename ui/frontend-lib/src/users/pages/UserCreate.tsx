import { useState, useCallback } from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { useNavigate } from "react-router";

import { Box, TextField, Button } from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { UserCreate, UserResponse } from "../types";

const UserCreatePageInner = () => {
  const { ikApi, linkPrefix } = useConfig();
  const {
    control,
    formState: { errors },
    trigger,
    handleSubmit,
  } = useFormContext<UserCreate>();

  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}users`);

  const handleSave = useCallback(
    async (data: UserCreate) => {
      setSaving(true);
      const isValid = await trigger();
      if (!isValid) {
        setSaving(false);
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }

      ikApi
        .postRaw("users", data)
        .then((response: UserResponse) => {
          if (response.id) {
            notify("User created successfully", "success");
            navigate(`${linkPrefix}users/${response.id}`);
          }
        })
        .catch((error: any) => {
          notifyError(error);
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [ikApi, navigate, trigger, setSaving, linkPrefix],
  );

  return (
    <PageContainer
      title="Create User"
      onBack={handleBack}
      backAriaLabel="Back to users"
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
            {saving ? "Saving..." : "Save"}
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
        <PropertyCard title="User Definition">
          <Box>
            <Controller
              name="identifier"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Identifier"
                  variant="outlined"
                  error={!!errors.identifier}
                  helperText={
                    errors.identifier
                      ? errors.identifier.message
                      : "Name of the user"
                  }
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "User identifier",
                    },
                  }}
                />
              )}
            />
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Description"
                  variant="outlined"
                  error={!!errors.description}
                  helperText={
                    errors.description
                      ? errors.description.message
                      : "Provide a short description"
                  }
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "User description",
                    },
                  }}
                />
              )}
            />
            <Controller
              name="password"
              control={control}
              rules={{ required: "Password is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Password"
                  variant="outlined"
                  error={!!errors.password}
                  type="password"
                  helperText={
                    errors.password
                      ? errors.password.message
                      : "Password for the user"
                  }
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "User password",
                    },
                  }}
                />
              )}
            />
          </Box>
        </PropertyCard>
      </Box>
    </PageContainer>
  );
};

const UserCreatePage = () => {
  const methods = useForm<UserCreate>({
    defaultValues: {
      identifier: "",
      description: "",
      password: "",
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <UserCreatePageInner />
    </FormProvider>
  );
};

UserCreatePage.path = "/users/create";

export { UserCreatePage };
