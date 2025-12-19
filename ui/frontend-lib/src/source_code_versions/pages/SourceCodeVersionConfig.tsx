import { useState, useCallback, useEffect } from "react";

import {
  useForm,
  useFieldArray,
  FormProvider,
  useFormContext,
} from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { Box, Alert, Button } from "@mui/material";

import { useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { ENTITY_STATUS } from "../../utils";
import { ConfigList } from "../components/ConfigList";
import {
  SourceCodeVersionConfigProvider,
  useSourceCodeVersionConfigContext,
} from "../context/SourceCodeVersionConfigContext";
import { SourceConfigUpdateWithId, SourceCodeVersionResponse } from "../types";

interface FormValues {
  configs: SourceConfigUpdateWithId[];
}

const SourceCodeVersionConfigContent = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const { sourceConfigs, templateReferences, sourceCodeVersion } =
    useSourceCodeVersionConfigContext();

  const { control, handleSubmit, reset } = useFormContext<FormValues>();

  const { fields } = useFieldArray({
    control,
    name: "configs",
  });

  useEffect(() => {
    if (sourceConfigs.length > 0) {
      const formattedConfigs = sourceConfigs.map((config) => ({
        id: config.id,
        name: config.name,
        type: config.type,
        description: config.description,
        required: config.required,
        default: config.default,
        frozen: config.frozen,
        unique: config.unique,
        restricted: config.restricted,
        sensitive: config.sensitive,
        options: config.options,
        reference_template_id:
          templateReferences.find((tr) => tr.input_config_name === config.name)
            ?.reference_template_id || null,
        output_config_name:
          templateReferences.find((tr) => tr.input_config_name === config.name)
            ?.output_config_name || null,
      }));
      reset({ configs: formattedConfigs });
    }
  }, [sourceConfigs, templateReferences, reset]);

  const handleBack = () =>
    navigate(`${linkPrefix}source_code_versions/${sourceCodeVersion.id}`);

  const onSubmit = useCallback(
    async (data: FormValues) => {
      const originalConfigs = sourceConfigs.map((config) => ({
        id: config.id,
        required: config.required,
        default: config.default,
        frozen: config.frozen,
        unique: config.unique,
        restricted: config.restricted,
        options: config.options,
        reference_template_id:
          templateReferences.find((tr) => tr.input_config_name === config.name)
            ?.reference_template_id || null,
        output_config_name:
          templateReferences.find((tr) => tr.input_config_name === config.name)
            ?.output_config_name || null,
      }));

      // Filter only changed configs
      const configsToSubmit = data.configs.filter((formConfig, index) => {
        const original = originalConfigs[index];
        if (!original) return true; // New config from reference

        return (
          formConfig.required !== original.required ||
          JSON.stringify(formConfig.default) !==
            JSON.stringify(original.default) ||
          formConfig.frozen !== original.frozen ||
          formConfig.unique !== original.unique ||
          formConfig.restricted !== original.restricted ||
          JSON.stringify(formConfig.options) !==
            JSON.stringify(original.options) ||
          formConfig.reference_template_id !== original.reference_template_id ||
          formConfig.output_config_name !== original.output_config_name
        );
      });

      if (configsToSubmit.length === 0) {
        notify("No changes to save", "info");
        return;
      }

      try {
        const changesArray: SourceConfigUpdateWithId[] = configsToSubmit.map(
          (config) => ({
            id: config.id,
            required: config.required,
            default: config.default,
            frozen: config.frozen,
            unique: config.unique,
            restricted: config.restricted,
            options: config.options,
            template_id: sourceCodeVersion.template.id,
            reference_template_id: config.reference_template_id,
            output_config_name: config.output_config_name,
          }),
        );

        await ikApi.updateRaw(
          `source_code_versions/${sourceCodeVersion.id}/configs`,
          changesArray,
        );

        notify("Configurations updated successfully", "success");

        navigate(`${linkPrefix}source_code_versions/${sourceCodeVersion.id}`);
      } catch (error: any) {
        notifyError(error);
      }
    },
    [
      sourceCodeVersion.id,
      ikApi,
      navigate,
      linkPrefix,
      sourceConfigs,
      templateReferences,
      sourceCodeVersion.template.id,
    ],
  );

  return (
    <PageContainer
      title={
        sourceCodeVersion.identifier ||
        "Manage Source Code Version Configurations"
      }
      onBack={handleBack}
      backAriaLabel="Back to source code version"
      bottomActions={
        <>
          <Button variant="outlined" color="primary" onClick={handleBack}>
            Cancel
          </Button>
          {sourceCodeVersion.status === ENTITY_STATUS.DONE &&
            sourceCodeVersion.variables.length > 0 && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit(onSubmit)}
              >
                Update
              </Button>
            )}
        </>
      }
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          width: "100%",
        }}
      >
        {sourceCodeVersion && (
          <>
            {sourceCodeVersion.status !== ENTITY_STATUS.DONE && (
              <Alert
                severity="warning"
                sx={{
                  mt: 2,
                  width: "75%",
                  minWidth: 320,
                  maxWidth: 1000,
                  alignSelf: "center",
                }}
              >
                Configurations can only be managed when the source code version
                is in the &quot;done&quot; state.
              </Alert>
            )}
            {sourceCodeVersion.status === ENTITY_STATUS.DONE &&
              sourceCodeVersion.variables.length === 0 && (
                <Alert
                  severity="info"
                  sx={{
                    mt: 2,
                    width: "75%",
                    minWidth: 320,
                    maxWidth: 1000,
                    alignSelf: "center",
                  }}
                >
                  This source code version has no variables.{" "}
                </Alert>
              )}
          </>
        )}

        {sourceCodeVersion.status === ENTITY_STATUS.DONE &&
          sourceCodeVersion.variables.length > 0 && (
            <ConfigList control={control} fields={fields} />
          )}
      </Box>
    </PageContainer>
  );
};

export const SourceCodeVersionConfigPage = () => {
  const { source_code_version_id } = useParams();
  const [entity, setEntity] = useState<SourceCodeVersionResponse>();
  const [error, setError] = useState<Error>();
  const { ikApi } = useConfig();

  const getSourceCodeVersion = useCallback(async (): Promise<any> => {
    await ikApi
      .get(`source_code_versions/${source_code_version_id}`)
      .then((response: SourceCodeVersionResponse) => {
        setEntity(response);
        setError(undefined);
      })
      .catch((e: any) => setError(e));
  }, [ikApi, source_code_version_id]);

  useEffectOnce(() => {
    getSourceCodeVersion();
  });
  const methods = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      configs: [],
    },
  });

  return (
    <>
      {error && (
        <Alert
          severity="error"
          sx={{
            mt: 2,
            width: "75%",
            minWidth: 320,
            maxWidth: 1000,
            alignSelf: "center",
          }}
        >
          {error.message}
        </Alert>
      )}
      {entity && (
        <SourceCodeVersionConfigProvider
          ikApi={ikApi}
          sourceCodeVersion={entity}
        >
          <FormProvider {...methods}>
            <SourceCodeVersionConfigContent />
          </FormProvider>
        </SourceCodeVersionConfigProvider>
      )}
    </>
  );
};

SourceCodeVersionConfigPage.path =
  "/source_code_versions/:source_code_version_id/configs";
