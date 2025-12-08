import { useState, useCallback } from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { useNavigate } from "react-router";

import { Box, TextField, Button } from "@mui/material";

import ReferenceSearchInput from "../../common/components/inputs/ReferenceSearchInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { PermissionResponse } from "../../permissions/types";
import { IkEntity } from "../../types";
import { RoleCreate } from "../types";

const RoleCreatePageInner = () => {
  const { ikApi, linkPrefix } = useConfig();
  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useFormContext<RoleCreate>();

  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}roles`);

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const handleSave = useCallback(
    (data: RoleCreate) => {
      ikApi
        .postRaw(`permissions/role`, data)
        .then((response: PermissionResponse) => {
          if (response.id) {
            notify(`Role created successfully: ${response.v1}`, "success");

            navigate(`${linkPrefix}roles/${response.v1}`);
            return response;
          }
        })
        .catch((error: any) => {
          notifyError(error);
        });
    },
    [ikApi, navigate, linkPrefix],
  );

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
          </Box>
        </PropertyCard>
      </Box>
    </PageContainer>
  );
};

const RoleCreatePage = () => {
  const form = useForm<RoleCreate>({
    defaultValues: {
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
