import { useCallback, useState } from "react";

import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import {
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  Button,
  Typography,
} from "@mui/material";

import { LabelInput } from "../../common";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import { MarkdownEditor } from "../../common/components/inputs/MarkdownEditor";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { IkEntity } from "../../types";
import {
  TemplateConfigurationFields,
  TemplateConfigurationControl,
} from "../components/TemplateConfigurationFields";
import { CREATE_TEMPLATE_MUTATION } from "../graphql";
import { TemplateCreateRequest } from "../types";

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
      documentation: "",
      template: "",
      parents: [],
      children: [],
      labels: [],
      cloudResourceTypes: [],
      configuration: {
        one_resource_per_integration: [],
        allowed_provider_integration_types: [],
        required_configuration_variables: [],
      },
      abstract: false,
    },
    mode: "onChange",
  });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const onSubmit = useCallback(
    async (data: TemplateCreateRequest) => {
      try {
        const input = {
          ...data,
          configuration: data.configuration,
        };
        const response = await ikApi.graphqlRequest<{
          createTemplate: {
            id: string;
          };
        }>(CREATE_TEMPLATE_MUTATION, { input });

        const createdTemplate = response.createTemplate;
        if (createdTemplate?.id) {
          notify("Template created successfully", "success");
          navigate(`${linkPrefix}templates/${createdTemplate.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      }
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
              <TextField
                {...field}
                label="Description"
                variant="outlined"
                error={!!errors.description}
                helperText={
                  errors.description
                    ? errors.description.message
                    : "Short summary of the template"
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
            name="documentation"
            control={control}
            render={({ field }) => (
              <MarkdownEditor
                {...field}
                label="Documentation"
                error={!!errors.documentation}
                helperText={
                  errors.documentation
                    ? errors.documentation.message
                    : "Markdown-formatted guidance for users of this template."
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
            name="cloudResourceTypes"
            control={control}
            render={({ field }) => (
              <ArrayReferenceInput
                ikApi={ikApi}
                buffer={buffer}
                setBuffer={setBuffer}
                {...field}
                entity_name="cloud_resources"
                error={!!errors.cloudResourceTypes}
                helpertext={
                  errors.cloudResourceTypes
                    ? errors.cloudResourceTypes.message
                    : "Cloud resource types of the template"
                }
                value={field.value}
                label="Select Cloud Resource Types"
                multiple
              />
            )}
          />
          <TemplateConfigurationFields
            control={control as unknown as TemplateConfigurationControl}
            errors={errors}
          />
        </Box>
      </PropertyCard>
    </PageContainer>
  );
};

TemplateCreatePage.path = "/templates/create";
