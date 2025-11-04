import { useState, useCallback } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { Button, Box, TextField, Alert } from "@mui/material";

import { LabelInput, useConfig } from "../../common";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { IkEntity } from "../../types";
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
      parents: entity.parents.map((parent: TemplateShort) => parent.id),
      children: entity.children.map((child: TemplateShort) => child.id),
      labels: entity.labels,
      cloud_resource_types: entity.cloud_resource_types,
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
        const response = await ikApi.patchRaw(`templates/${entity.id}`, data);
        if (response.id) {
          notify("Template updated successfully", "success");
          navigate(`${linkPrefix}templates/${response.id}`);
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
                        : "Provide a short description"
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
      .get(`templates/${template_id}`)
      .then((response: TemplateResponse) => {
        setEntity(response);
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
