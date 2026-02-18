import { useState, useCallback } from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { useNavigate } from "react-router";

import { Box, TextField, Button, MenuItem } from "@mui/material";

import { LabelInput } from "../../common";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { IkEntity } from "../../types";
import { renderFieldsForProvider } from "../components/StorageProviderForms";
import { StorageCreate, StorageResponse } from "../types";

const storage_types = ["tofu"];

const StorageCreatePageInner = () => {
  const { ikApi, linkPrefix, globalConfig } = useConfig();
  const {
    control,
    formState: { errors },
    watch,
    trigger,
    handleSubmit,
  } = useFormContext<StorageCreate>();

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const selectedProvider = watch("storage_provider");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}storages`);

  const handleSave = useCallback(
    async (data: StorageCreate) => {
      setSaving(true);
      const isValid = await trigger();
      if (!isValid) {
        setSaving(false);
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }
      const updatedData = {
        ...data,
        configuration: {
          ...data.configuration,
          storage_provider: data.storage_provider,
        },
      };

      ikApi
        .postRaw("storages", updatedData)
        .then((response: StorageResponse) => {
          if (response.id) {
            notify("Storage created successfully", "success");
            navigate(`${linkPrefix}storages/${response.id}`);
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
      title="Create Storage"
      onBack={handleBack}
      backAriaLabel="Back to storages"
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
        <PropertyCard title="Storage Definition">
          <Box>
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  variant="outlined"
                  error={!!errors.name}
                  helperText={
                    errors.name ? errors.name.message : "Provide a unique name"
                  }
                  fullWidth
                  margin="normal"
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
                />
              )}
            />
            <Controller
              name="labels"
              control={control}
              defaultValue={[]}
              render={({ field }) => <LabelInput {...field} errors={errors} />}
            />
            <Controller
              name="storage_provider"
              control={control}
              rules={{ required: "Storage provider is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Storage Provider"
                  variant="outlined"
                  error={!!errors.storage_provider}
                  helperText={
                    errors.storage_provider
                      ? errors.storage_provider.message
                      : "Select the storage provider"
                  }
                  fullWidth
                  margin="normal"
                >
                  {globalConfig?.storage_provider_registry?.map(
                    (option: string) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ),
                  )}
                </TextField>
              )}
            />

            <Controller
              name="integration_id"
              control={control}
              rules={{ required: "Integration is required" }}
              render={({ field }) => (
                <ReferenceInput
                  disabled={!selectedProvider}
                  ikApi={ikApi}
                  buffer={buffer}
                  setBuffer={setBuffer}
                  {...field}
                  entity_name="integrations"
                  filter={{
                    integration_type: "cloud",
                    integration_provider: selectedProvider,
                  }}
                  error={!!errors.integration_id}
                  helpertext={
                    errors.integration_id
                      ? errors.integration_id.message
                      : "Select credentials for the storage"
                  }
                  value={field.value}
                  label="Select Integration"
                  required
                />
              )}
            />
            <Controller
              name="storage_type"
              control={control}
              rules={{ required: "Storage type is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  disabled
                  label="Storage Type"
                  variant="outlined"
                  error={!!errors.storage_type}
                  helperText={
                    errors.storage_type
                      ? errors.storage_type.message
                      : "Select the storage type"
                  }
                  fullWidth
                  margin="normal"
                >
                  {storage_types.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Box>
        </PropertyCard>

        <PropertyCard title="Configuration">
          <Box>
            {renderFieldsForProvider(selectedProvider, control, errors)}
          </Box>
        </PropertyCard>
      </Box>
    </PageContainer>
  );
};

const StorageCreatePage = () => {
  const methods = useForm<StorageCreate>({
    defaultValues: {
      name: "",
      description: "",
      integration_id: "",
      labels: [],
      storage_type: "tofu",
      storage_provider: "",
      configuration: {},
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <StorageCreatePageInner />
    </FormProvider>
  );
};

StorageCreatePage.path = "/storages/create";

export { StorageCreatePage };
