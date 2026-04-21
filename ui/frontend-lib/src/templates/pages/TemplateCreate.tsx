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
import { MarkdownEditor } from "../../common/components/inputs/MarkdownEditor";
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
        one_resource_per_integration: [],
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
                required
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
              <MarkdownEditor
                {...field}
                label="Documentation"
                error={!!errors.description}
                helperText={
                  errors.description
                    ? errors.description.message
                    : "Markdown-formatted guidance for users of this template. Supports headings, lists, tables, and code blocks."
                }
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
                required
                variant="outlined"
                error={!!errors.template}
                helperText={
                  errors.template
                    ? errors.template.message
                    : "Unique key for the template. Only letters, numbers, and underscores are allowed."
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
                  label="Abstract Template"
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: -1, mb: 1 }}
                >
                  Abstract templates represent reusable entities such as Org,
                  Team, or Project. They do not provision infrastructure
                  directly, but provide values for other templates.
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
                    label="Integration Providers to filter on"
                    error={!!errors.configuration?.one_resource_per_integration}
                    helperText={
                      errors.configuration?.one_resource_per_integration
                        ? errors.configuration.one_resource_per_integration
                            .message
                        : "Enforce one resource per integration for selected providers (empty means all providers)"
                    }
                    fullWidth
                    margin="normal"
                  />
                )}
              />
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
