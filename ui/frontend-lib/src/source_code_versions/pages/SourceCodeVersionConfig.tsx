import { useState, useCallback, useEffect, SyntheticEvent } from "react";

import { useForm, useFieldArray } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { useEffectOnce } from "react-use";

import { Box, Alert, Button } from "@mui/material";

import { useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { ENTITY_STATUS } from "../../utils";
import { ConfigList } from "../components/ConfigList";
import { ReferenceSelector } from "../components/ReferenceSelector";
import { useSourceCodeVersionConfig } from "../hooks/useSourceCodeVersionConfig";
import {
  SourceConfigUpdateWithId,
  SourceCodeVersionResponse,
  SourceConfigUpdate,
} from "../types";

interface FormValues {
  configs: Array<
    SourceConfigUpdate & {
      id: string;
      name: string;
      type: string;
      description: string;
    }
  >;
}

const SourceCodeVersionConfigContent = (props: {
  entity: SourceCodeVersionResponse;
}) => {
  const { entity } = props;
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const {
    references,
    selectedReferenceId,
    sourceConfigs,
    sourceCodeVersions,
    handleReferenceChange,
  } = useSourceCodeVersionConfig({ ikApi, entity });

  const [hasSelectedReference, setHasSelectedReference] = useState(false);

  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      configs: [],
    },
  });

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
        reference_id: config.reference ? config.reference.id : null,
        reference: config.reference,
      }));
      reset({ configs: formattedConfigs });
    }
  }, [sourceConfigs, reset]);

  const handleBack = () =>
    navigate(`${linkPrefix}source_code_versions/${entity.id}`);

  const handleReferenceChangeEvent = (
    _event: SyntheticEvent,
    newValue: SourceCodeVersionResponse | null,
  ) => {
    const newReferenceId = newValue ? newValue.id : "";
    handleReferenceChange(newReferenceId);
    // Mark that a reference has been selected
    if (newReferenceId) {
      setHasSelectedReference(true);
    }
  };

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
        reference_id: config.reference ? config.reference.id : null,
      }));

      // When a reference is selected, we want to save all configs even if not manually changed
      // Otherwise, only save changed configs
      let configsToSubmit: typeof data.configs;

      if (hasSelectedReference && !formState.isDirty) {
        // Reference selected but no manual changes - submit all configs
        configsToSubmit = data.configs;
      } else {
        // Filter only changed configs
        configsToSubmit = data.configs.filter((formConfig, index) => {
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
            formConfig.reference_id !== original.reference_id
          );
        });
      }

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
            reference_id: config.reference_id,
          }),
        );

        await ikApi.updateRaw(
          `source_code_versions/${entity.id}/configs`,
          changesArray,
        );

        notify("Configurations updated successfully", "success");

        navigate(`${linkPrefix}source_code_versions/${entity.id}`);
      } catch (error: any) {
        notifyError(error);
      }
    },
    [
      entity.id,
      ikApi,
      navigate,
      linkPrefix,
      sourceConfigs,
      hasSelectedReference,
      formState.isDirty,
    ],
  );

  return (
    <PageContainer
      title={entity.identifier || "Manage Source Code Version Configurations"}
      onBack={handleBack}
      backAriaLabel="Back to source code version"
      bottomActions={
        <>
          <Button variant="outlined" color="primary" onClick={handleBack}>
            Cancel
          </Button>
          {entity.status === ENTITY_STATUS.DONE &&
            entity.variables.length > 0 && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit(onSubmit)}
                disabled={!formState.isDirty && !hasSelectedReference}
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
        {entity && (
          <>
            {entity.status !== ENTITY_STATUS.DONE && (
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
            {entity.status === ENTITY_STATUS.DONE &&
              entity.variables.length === 0 && (
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

        {entity.status === ENTITY_STATUS.DONE &&
          entity.variables.length > 0 && (
            <>
              <ReferenceSelector
                references={references.filter((ref) => ref.id !== entity.id)}
                selectedReferenceId={selectedReferenceId}
                onReferenceChange={handleReferenceChangeEvent}
              />

              <ConfigList
                control={control}
                fields={fields}
                entityId={entity.id}
                sourceCodeVersions={sourceCodeVersions}
                selectedReferenceId={selectedReferenceId}
              />
            </>
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
      {entity && <SourceCodeVersionConfigContent entity={entity} />}
    </>
  );
};

SourceCodeVersionConfigPage.path =
  "/source_code_versions/:source_code_version_id/configs";
