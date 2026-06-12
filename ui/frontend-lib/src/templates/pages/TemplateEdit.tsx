import { useState, useCallback } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { Button, Box, TextField, Alert } from "@mui/material";

import { LabelInput, useConfig } from "../../common";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import { MarkdownEditor } from "../../common/components/inputs/MarkdownEditor";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { IkEntity } from "../../types";
import { NamingConventionInput } from "../components/NamingConventionInput";
import {
  TemplateConfigurationFields,
  TemplateConfigurationControl,
} from "../components/TemplateConfigurationFields";
import {
  GqlTemplate,
  TEMPLATE_QUERY,
  UPDATE_TEMPLATE_MUTATION,
  toTemplateUpdateMutationInput,
  transformTemplate,
} from "../graphql";
import { TemplateResponse, TemplateShort, TemplateUpdate } from "../types";

export const TemplateEditPageInner = (props: { entity: TemplateResponse }) => {
  const { linkPrefix, ikApi } = useConfig();
  const { entity } = props;
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}templates/${entity.id}`);

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const methods = useForm<TemplateUpdate>({
    mode: "onChange",
    defaultValues: {
      name: entity.name,
      description: entity.description,
      documentation: entity.documentation || "",
      parents: entity.parents.map((parent: TemplateShort) => parent.id),
      children: entity.children.map((child: TemplateShort) => child.id),
      labels: entity.labels,
      cloud_resource_types: entity.cloud_resource_types,
      configuration: {
        one_resource_per_integration:
          entity.configuration?.one_resource_per_integration || [],
        allowed_provider_integration_types:
          entity.configuration?.allowed_provider_integration_types || [],
        naming_convention: entity.configuration?.naming_convention ?? null,
        required_configuration_variables:
          entity.configuration?.required_configuration_variables || [],
      },
    },
  });

  const {
    control,
    handleSubmit,
    trigger,
    formState: { errors },
  } = methods;

  const onSubmit = useCallback(
    async (data: TemplateUpdate) => {
      if (!entity) return;

      const isValid = await trigger();
      if (!isValid) {
        notifyError(new Error("Please fill in all required fields"));
        return;
      }

      try {
        const input = toTemplateUpdateMutationInput(data);
        const response = await ikApi.graphqlRequest<{
          updateTemplate: {
            id: string;
          };
        }>(UPDATE_TEMPLATE_MUTATION, {
          id: entity.id,
          input,
        });

        if (response.updateTemplate?.id) {
          notify("Template updated successfully", "success");
          navigate(`${linkPrefix}templates/${response.updateTemplate.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [entity, trigger, ikApi, linkPrefix, navigate],
  );

  return (
    <FormProvider {...methods}>
      <PageContainer
        title="Edit Template"
        onBack={handleBack}
        backAriaLabel="Back to template"
        bottomActions={
          <>
            <Button variant="outlined" color="primary" onClick={handleBack}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit(onSubmit)}
            >
              Update
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
                      errors.name
                        ? errors.name.message
                        : "Provide a unique name"
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
                        : "Provide a short summary"
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
                      errors.parents
                        ? errors.parents.message
                        : "Parents of the component"
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
                      errors.children
                        ? errors.children.message
                        : "Children of the component"
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
                render={({ field }) => (
                  <LabelInput errors={errors} {...field} />
                )}
              />
            </Box>
          </PropertyCard>

          <PropertyCard title="Template Configuration">
            <Box>
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
                    error={!!errors.children}
                    helpertext={
                      errors.children
                        ? errors.children.message
                        : "Cloud Resource Types of the component"
                    }
                    value={field.value}
                    label="Select Cloud Resource Type"
                    multiple
                  />
                )}
              />
              <TemplateConfigurationFields
                control={control as unknown as TemplateConfigurationControl}
                errors={errors}
              />
              <Controller
                name="configuration.naming_convention"
                control={control}
                render={({ field }) => (
                  <NamingConventionInput
                    template_id={entity.id}
                    parents={entity.parents}
                    value={field.value}
                    onChange={field.onChange}
                    error={!!errors.configuration?.naming_convention}
                    helperText={
                      errors.configuration?.naming_convention
                        ? (errors.configuration.naming_convention as any)
                            .message
                        : undefined
                    }
                  />
                )}
              />
            </Box>
          </PropertyCard>
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

export const TemplateEditPage = () => {
  const { template_id } = useParams();

  const [entity, setEntity] = useState<TemplateResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getTemplate = useCallback(async (): Promise<any> => {
    await ikApi
      .graphqlRequest<{ template: GqlTemplate | null }>(TEMPLATE_QUERY, {
        id: template_id,
      })
      .then((response) => {
        if (!response.template) {
          throw new Error("Template not found");
        }
        setEntity(transformTemplate(response.template));
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, template_id]);

  useEffectOnce(() => {
    getTemplate();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && <TemplateEditPageInner entity={entity} />}
    </>
  );
};

TemplateEditPage.path = "/templates/:template_id/edit";
