import { useState, useCallback } from "react";

import {
  Control,
  useForm,
  Controller,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { useNavigate } from "react-router";

import { LabelInput } from "../../common";
import { PropertyCard } from "../../common/components/cards/PropertyCard";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { IkEntity } from "../../types";
import { Button, TextField, MenuItem } from "../../ui";
import { renderFieldsForProvider } from "../components/StorageProviderForms";
import { CREATE_STORAGE_MUTATION } from "../graphql";
import { StorageCreate } from "../types";

const storageTypes = ["tofu"];

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

  const selectedProvider = watch("storageProvider");
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
      const input = {
        ...data,
        configuration: {
          ...data.configuration,
          storage_provider: data.storageProvider,
        },
      };
      try {
        const response = await ikApi.graphqlRequest<{
          createStorage: { id: string };
        }>(CREATE_STORAGE_MUTATION, { input });
        const createdStorage = response.createStorage;
        if (createdStorage?.id) {
          notify("Storage created successfully", "success");
          navigate(`${linkPrefix}storages/${createdStorage.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      } finally {
        setSaving(false);
      }
    },
    [ikApi, navigate, trigger, setSaving, linkPrefix],
  );

  return (
    <PageContainer
      title="Create Storage"
      bottomActions={
        <>
          <Button onClick={handleBack}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit(handleSave)}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="flex w-full min-w-80 flex-col items-center">
        <PropertyCard title="Storage Definition">
          <div>
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
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
              name="storageProvider"
              control={control}
              rules={{ required: "Storage provider is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Storage Provider"
                  error={!!errors.storageProvider}
                  helperText={
                    errors.storageProvider
                      ? errors.storageProvider.message
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
              name="integrationId"
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
                  error={!!errors.integrationId}
                  helpertext={
                    errors.integrationId
                      ? errors.integrationId.message
                      : "Select credentials for the storage"
                  }
                  value={field.value}
                  label="Select Integration"
                  required
                />
              )}
            />
            <Controller
              name="storageType"
              control={control}
              rules={{ required: "Storage type is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  disabled
                  label="Storage Type"
                  error={!!errors.storageType}
                  helperText={
                    errors.storageType
                      ? errors.storageType.message
                      : "Select the storage type"
                  }
                  fullWidth
                  margin="normal"
                >
                  {storageTypes.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </div>
        </PropertyCard>

        <PropertyCard title="Configuration">
          <div>
            {renderFieldsForProvider(
              selectedProvider,
              control as Control<any>,
              errors,
            )}
          </div>
        </PropertyCard>
      </div>
    </PageContainer>
  );
};

const StorageCreatePage = () => {
  const methods = useForm<StorageCreate>({
    defaultValues: {
      name: "",
      description: "",
      integrationId: "",
      labels: [],
      storageType: "tofu",
      storageProvider: "",
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
