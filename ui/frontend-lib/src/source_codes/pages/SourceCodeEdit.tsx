import { useState, useCallback } from "react";

import { Controller, FormProvider, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { Button, Box, TextField, Alert } from "@mui/material";

import { LabelInput, useConfig } from "../../common";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { getRepoNameFromUrl } from "../../common/utils";
import { IkEntity } from "../../types";
import { SourceCodeResponse, SourceCodeUpdate } from "../types";

export const SourceCodeEditPageInner = (props: {
  entity: SourceCodeResponse;
}) => {
  const { linkPrefix, ikApi } = useConfig();
  const { entity } = props;
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}source_codes/${entity.id}`);

  const methods = useForm<SourceCodeUpdate>({
    mode: "onChange",
    defaultValues: {
      description: entity.description,
      labels: entity.labels,
      integration_id: entity.integration ? entity.integration.id : "",
    },
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
    trigger,
  } = methods;

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const onSubmit = useCallback(
    async (data: any) => {
      if (entity) {
        const isValid = await trigger();

        if (!isValid) {
          notifyError(new Error("Please fix the errors in the form"));
        }

        ikApi
          .patchRaw(`source_codes/${entity.id}`, data)
          .then((response: SourceCodeResponse) => {
            if (response.id) {
              navigate(`${linkPrefix}source_codes/${response.id}`);
              return response;
            }
          })
          .catch((error) => {
            notifyError(error);
          });
      }
    },
    [ikApi, entity, trigger, linkPrefix, navigate],
  );

  return (
    <FormProvider {...methods}>
      <PageContainer
        title={"Edit Code Repository"}
        onBack={handleBack}
        backAriaLabel="Back"
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
          <PropertyCard title={getRepoNameFromUrl(entity.source_code_url)}>
            <Controller
              name="integration_id"
              control={control}
              render={({ field }) => (
                <ReferenceInput
                  ikApi={ikApi}
                  buffer={buffer}
                  setBuffer={setBuffer}
                  {...field}
                  entity_name="integrations"
                  filter={{ integration_type: "git" }}
                  error={!!errors.integration_id}
                  helpertext={
                    errors.integration_id
                      ? errors.integration_id.message
                      : "Select credentials for the source code"
                  }
                  value={field.value}
                  label="Select Integration"
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
          </PropertyCard>
        </Box>
      </PageContainer>
    </FormProvider>
  );
};

export const SourceCodeEditPage = () => {
  const { source_code_id } = useParams();

  const [entity, setEntity] = useState<SourceCodeResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getSourceCode = useCallback(async (): Promise<any> => {
    await ikApi
      .get(`source_codes/${source_code_id}`)
      .then((response) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, source_code_id]);

  useEffectOnce(() => {
    getSourceCode();
  });

  return (
    <>
      {error && <Alert severity="error">{error.message}</Alert>}
      {entity && <SourceCodeEditPageInner entity={entity} />}
    </>
  );
};

SourceCodeEditPage.path = "/source_codes/:source_code_id/edit";
