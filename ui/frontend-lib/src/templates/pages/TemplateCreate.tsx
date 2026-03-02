import { useCallback, useState } from "react";

import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import {
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  Button,
  Autocomplete,
  Chip,
  Typography,
} from "@mui/material";

import { LabelInput } from "../../common";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { getProviderDisplayName } from "../../common/utils";
import { IkEntity } from "../../types";
import { INTEGRATION_PROVIDER_OPTIONS } from "../constants";
import {
  TemplateCreateRequest,
  TemplateResponse,
  IntegrationProviderType,
} from "../types";

export const TemplateCreatePage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TemplateCreateRequest>({
    defaultValues: {
      name: "",
      description: "",
      template: "",
      parents: [],
      children: [],
      labels: [],
      cloud_resource_types: [],
      configuration: {
        one_resource_per_integration: false,
        allowed_provider_integration_types: [],
      },
      abstract: false,
    },
    mode: "onChange",
  });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const onSubmit = useCallback(
    (data: TemplateCreateRequest) => {
      ikApi
        .postRaw("templates", data)
        .then((response: TemplateResponse) => {
          if (response.id) {
            notify("Template created successfully", "success");
            navigate(`${linkPrefix}templates/${response.id}`);
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
      title="Create Template"
      onBack={() => navigate(`${linkPrefix}templates`)}
      backAriaLabel="Back to templates"
      bottomActions={
        <>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}templates`)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(onSubmit)}
          >
            Save
          </Button>
        </>
      }
    >
      <PropertyCard title="Template Definition">
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
                  errors.name ? errors.name.message : "Name of the template"
                }
                fullWidth
                margin="normal"
                slotProps={{
                  htmlInput: {
                    "aria-label": "Template name",
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
                    : "Description of the template"
                }
                fullWidth
                margin="normal"
                slotProps={{
                  htmlInput: {
                    "aria-label": "Template description",
                  },
                }}
              />
            )}
          />
          <Controller
            name="template"
            control={control}
            rules={{ required: "Template Key is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Template Key"
                variant="outlined"
                error={!!errors.template}
                helperText={
                  errors.template
                    ? errors.template.message
                    : "Unique key for the template"
                }
                fullWidth
                margin="normal"
                slotProps={{
                  htmlInput: {
                    "aria-label": "Template key",
                  },
                }}
              />
            )}
          />
          <Controller
            name="parents"
            control={control}
            render={({ field }) => (
              <ArrayReferenceInput
                ikApi={ikApi}
                buffer={buffer}
                setBuffer={setBuffer}
                {...field}
                entity_name="templates"
                error={!!errors.parents}
                helpertext={
                  errors.parents ? errors.parents.message : "Parent templates"
                }
                value={field.value}
                label="Select Parents"
                multiple
              />
            )}
          />
          <Controller
            name="children"
            control={control}
            render={({ field }) => (
              <ArrayReferenceInput
                ikApi={ikApi}
                buffer={buffer}
                setBuffer={setBuffer}
                {...field}
                entity_name="templates"
                error={!!errors.children}
                helpertext={
                  errors.children ? errors.children.message : "Child templates"
                }
                value={field.value}
                label="Select Children"
                multiple
              />
            )}
          />
          <Controller
            name="labels"
            control={control}
            defaultValue={[]}
            render={({ field }) => <LabelInput errors={errors} {...field} />}
          />
        </Box>
      </PropertyCard>

      <PropertyCard title="Template Configuration">
        <Box>
          <Controller
            name="abstract"
            control={control}
            render={({ field }) => (
              <Box>
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label="Abstract (if true, won't be instantiated)"
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: -1, mb: 1 }}
                >
                  Abstract templates are used as reusable building blocks and
                  cannot be instantiated directly.
                </Typography>
              </Box>
            )}
          />
          <Controller
            name="cloud_resource_types"
            control={control}
            render={({ field }) => (
              <ArrayReferenceInput
                ikApi={ikApi}
                buffer={buffer}
                setBuffer={setBuffer}
                {...field}
                entity_name="cloud_resources"
                error={!!errors.cloud_resource_types}
                helpertext={
                  errors.cloud_resource_types
                    ? errors.cloud_resource_types.message
                    : "Cloud resource types of the template"
                }
                value={field.value}
                label="Select Cloud Resource Types"
                multiple
              />
            )}
          />
          <Controller
            name="configuration.one_resource_per_integration"
            control={control}
            render={({ field }) => (
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!field.value}
                      onChange={(event) => field.onChange(event.target.checked)}
                    />
                  }
                  label="Allow only one resource per integration"
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: -1, mb: 1 }}
                >
                  Enforces a single resource per integration when this template
                  is used.
                </Typography>
              </Box>
            )}
          />
          <Controller
            name="configuration.allowed_provider_integration_types"
            control={control}
            render={({ field }) => (
              <Autocomplete
                multiple
                options={INTEGRATION_PROVIDER_OPTIONS}
                value={field.value || []}
                onChange={(_event, newValue) => field.onChange(newValue)}
                getOptionLabel={(option) => getProviderDisplayName(option)}
                renderValue={(
                  value: readonly IntegrationProviderType[],
                  getTagProps,
                ) =>
                  value.map(
                    (option: IntegrationProviderType, index: number) => {
                      const { key, ...rest } = getTagProps({ index });
                      return (
                        <Chip
                          key={key}
                          {...rest}
                          variant="outlined"
                          label={getProviderDisplayName(option)}
                        />
                      );
                    },
                  )
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Allowed Integration Providers"
                    error={
                      !!errors.configuration?.allowed_provider_integration_types
                    }
                    helperText={
                      errors.configuration?.allowed_provider_integration_types
                        ? errors.configuration
                            .allowed_provider_integration_types.message
                        : "Restrict template usage to selected providers (empty means all providers)"
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
    </PageContainer>
  );
};

TemplateCreatePage.path = "/templates/create";
