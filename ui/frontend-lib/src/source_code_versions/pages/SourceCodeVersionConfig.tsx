import { useState, useCallback, useEffect, useMemo } from "react";

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
import { ReferenceSelector } from "../components/ReferenceSelector";
import {
  SourceCodeVersionConfigProvider,
  useSourceCodeVersionConfigContext,
} from "../context/SourceCodeVersionConfigContext";
import { SourceConfigUpdateWithId, SourceCodeVersionResponse } from "../types";
import { normalizeNumericField, parseNumericField } from "../utils/numeric";

interface FormValues {
  configs: SourceConfigUpdateWithId[];
}

interface ConfigSnapshot {
  id: string;
  required: boolean;
  default: unknown;
  frozen: boolean;
  unique: boolean;
  restricted: boolean;
  options: unknown;
  validation_rule_id: string | null;
  validation_regex: string;
  validation_min_value: string;
  validation_max_value: string;
  validation_enabled: boolean;
  reference_template_id: string | null;
  output_config_name: string | null;
}

type ValidationRuleUpdate =
  | {
      action: "upsert";
      target_type: "string" | "number";
      rule_id?: string | null;
      regex_pattern?: string | null;
      min_value?: number | null;
      max_value?: number | null;
    }
  | {
      action: "clear";
      target_type: "string" | "number";
    };

const hasConfigChanged = (
  formConfig: SourceConfigUpdateWithId,
  original?: ConfigSnapshot,
): boolean => {
  if (!original) {
    return true;
  }

  return (
    formConfig.required !== original.required ||
    JSON.stringify(formConfig.default) !== JSON.stringify(original.default) ||
    formConfig.frozen !== original.frozen ||
    formConfig.unique !== original.unique ||
    formConfig.restricted !== original.restricted ||
    JSON.stringify(formConfig.options) !== JSON.stringify(original.options) ||
    formConfig.reference_template_id !== original.reference_template_id ||
    formConfig.output_config_name !== original.output_config_name ||
    formConfig.validation_rule_id !== original.validation_rule_id ||
    (formConfig.validation_regex || "") !== (original.validation_regex || "") ||
    normalizeNumericField(formConfig.validation_min_value) !==
      normalizeNumericField(original.validation_min_value) ||
    normalizeNumericField(formConfig.validation_max_value) !==
      normalizeNumericField(original.validation_max_value) ||
    Boolean(formConfig.validation_enabled) !==
      Boolean(original.validation_enabled)
  );
};

const buildValidationRuleUpdate = (
  config: SourceConfigUpdateWithId,
  sourceConfig: { type: string },
  ruleIdForSubmission: string | null,
  original?: ConfigSnapshot,
): ValidationRuleUpdate | null => {
  const targetType = sourceConfig.type === "number" ? "number" : "string";
  const trimmedRegex = (config.validation_regex || "").trim();
  const normalizedMin = parseNumericField(config.validation_min_value);
  const normalizedMax = parseNumericField(config.validation_max_value);
  const wantsValidation = Boolean(config.validation_enabled);

  const hasConstraints =
    wantsValidation &&
    (Boolean(trimmedRegex) || normalizedMin !== null || normalizedMax !== null);

  const originalTrimmedRegex = (original?.validation_regex || "").trim();
  const originalMin = parseNumericField(original?.validation_min_value);
  const originalMax = parseNumericField(original?.validation_max_value);
  const originalWantsValidation = Boolean(original?.validation_enabled);
  const originalHasConstraints =
    originalWantsValidation &&
    (Boolean(originalTrimmedRegex) ||
      originalMin !== null ||
      originalMax !== null);

  if (hasConstraints) {
    return {
      action: "upsert",
      target_type: targetType,
      rule_id: ruleIdForSubmission,
      regex_pattern:
        targetType === "string" && trimmedRegex ? trimmedRegex : null,
      min_value:
        targetType === "number" && normalizedMin !== null
          ? normalizedMin
          : null,
      max_value:
        targetType === "number" && normalizedMax !== null
          ? normalizedMax
          : null,
    };
  }

  if (originalHasConstraints) {
    return {
      action: "clear",
      target_type: targetType,
    };
  }

  return null;
};

const hasValidationData = (config: {
  validation_regex?: string | null;
  validation_min_value?: string | number | null;
  validation_max_value?: string | number | null;
  validation_rule_id?: string | null;
}): boolean => {
  const regexValue =
    typeof config.validation_regex === "string"
      ? config.validation_regex
      : config.validation_regex
        ? String(config.validation_regex)
        : "";
  const hasRegex = regexValue.trim().length > 0;
  const hasMin =
    config.validation_min_value !== null &&
    config.validation_min_value !== undefined &&
    config.validation_min_value !== "";
  const hasMax =
    config.validation_max_value !== null &&
    config.validation_max_value !== undefined &&
    config.validation_max_value !== "";
  const hasReference = Boolean(config.validation_rule_id);

  return hasRegex || hasMin || hasMax || hasReference;
};

const SourceCodeVersionConfigContent = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const {
    sourceConfigs,
    templateReferences,
    sourceCodeVersion,
    selectedReferenceId,
  } = useSourceCodeVersionConfigContext();

  const { control, handleSubmit, reset } = useFormContext<FormValues>();

  const { fields } = useFieldArray({
    control,
    name: "configs",
  });

  const templateReferenceMap = useMemo(
    () =>
      new Map(
        templateReferences.map((reference) => [
          reference.input_config_name,
          {
            reference_template_id: reference.reference_template_id || null,
            output_config_name: reference.output_config_name || null,
          },
        ]),
      ),
    [templateReferences],
  );

  const originalConfigs = useMemo<ConfigSnapshot[]>(
    () =>
      sourceConfigs.map((config) => {
        const templateReference = templateReferenceMap.get(config.name);

        return {
          id: config.id,
          required: config.required,
          default: config.default,
          frozen: config.frozen,
          unique: config.unique,
          restricted: config.restricted,
          options: config.options,
          validation_rule_id: config.validation_rule_id ?? null,
          validation_regex: config.validation_regex || "",
          validation_min_value: normalizeNumericField(
            config.validation_min_value,
          ),
          validation_max_value: normalizeNumericField(
            config.validation_max_value,
          ),
          validation_enabled: hasValidationData(config),
          reference_template_id:
            templateReference?.reference_template_id || null,
          output_config_name: templateReference?.output_config_name || null,
        };
      }),
    [sourceConfigs, templateReferenceMap],
  );

  const originalConfigMap = useMemo(
    () => new Map(originalConfigs.map((config) => [config.id, config])),
    [originalConfigs],
  );

  const sourceConfigMap = useMemo(
    () => new Map(sourceConfigs.map((config) => [config.id, config])),
    [sourceConfigs],
  );

  useEffect(() => {
    if (sourceConfigs.length > 0) {
      const formattedConfigs = sourceConfigs.map((config) => {
        const templateReference = templateReferenceMap.get(config.name);
        const normalizedMin = normalizeNumericField(
          config.validation_min_value,
        );
        const normalizedMax = normalizeNumericField(
          config.validation_max_value,
        );

        return {
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
          validation_rule_id: config.validation_rule_id ?? null,
          validation_regex: config.validation_regex || "",
          validation_min_value: normalizedMin,
          validation_max_value: normalizedMax,
          validation_enabled: hasValidationData(config),
          reference_template_id:
            templateReference?.reference_template_id || null,
          output_config_name: templateReference?.output_config_name || null,
        };
      });
      reset({ configs: formattedConfigs });
    }
  }, [sourceConfigs, templateReferenceMap, reset]);

  const handleBack = () =>
    navigate(`${linkPrefix}source_code_versions/${sourceCodeVersion.id}`);

  const onSubmit = useCallback(
    async (data: FormValues) => {
      // When a reference is selected, we want to save all configs even if not manually changed
      // Otherwise, only save changed configs
      let configsToSubmit: typeof data.configs;
      if (selectedReferenceId) {
        configsToSubmit = data.configs;
      } else {
        configsToSubmit = data.configs.filter((formConfig) =>
          hasConfigChanged(formConfig, originalConfigMap.get(formConfig.id)),
        );
      }

      if (configsToSubmit.length === 0) {
        notify("No changes to save", "info");
        return;
      }

      try {
        const configUpdates: SourceConfigUpdateWithId[] = [];
        const validationRuleUpdates = new Map<string, ValidationRuleUpdate>();

        configsToSubmit.forEach((config) => {
          const sourceConfig = sourceConfigMap.get(config.id);
          const ruleIdForSubmission =
            sourceConfig?.type === "string"
              ? (config.validation_rule_id ?? null)
              : null;

          configUpdates.push({
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
            validation_rule_id: ruleIdForSubmission,
            validation_enabled: config.validation_enabled,
            validation_regex: config.validation_regex || "",
            validation_min_value: normalizeNumericField(
              config.validation_min_value,
            ),
            validation_max_value: normalizeNumericField(
              config.validation_max_value,
            ),
          });

          if (!sourceConfig) {
            return;
          }

          const original = originalConfigMap.get(config.id);
          const validationRuleUpdate = buildValidationRuleUpdate(
            config,
            sourceConfig,
            ruleIdForSubmission,
            original,
          );

          if (validationRuleUpdate) {
            validationRuleUpdates.set(sourceConfig.name, validationRuleUpdate);
          }
        });

        if (configUpdates.length > 0) {
          await ikApi.updateRaw(
            `source_code_versions/${sourceCodeVersion.id}/configs`,
            configUpdates,
          );
        }

        for (const [variableName, validationData] of validationRuleUpdates) {
          if (validationData.action === "clear") {
            await ikApi.updateRaw(
              `validation_rules/template/${sourceCodeVersion.template.id}/${variableName}`,
              { rules: [] },
            );
            continue;
          }

          const rules = [];
          const rule: any = {
            target_type: validationData.target_type,
          };

          if (validationData.regex_pattern) {
            rule.regex_pattern = validationData.regex_pattern;
          }
          if (
            validationData.min_value !== null &&
            validationData.min_value !== undefined
          ) {
            rule.min_value = validationData.min_value;
          }
          if (
            validationData.max_value !== null &&
            validationData.max_value !== undefined
          ) {
            rule.max_value = validationData.max_value;
          }

          if (validationData.rule_id) {
            rule.id = validationData.rule_id;
          }

          rules.push(rule);

          await ikApi.updateRaw(
            `validation_rules/template/${sourceCodeVersion.template.id}/${variableName}`,
            { rules },
          );
        }

        notify("Configurations updated successfully", "success");

        navigate(`${linkPrefix}source_code_versions/${sourceCodeVersion.id}`);
      } catch (error: any) {
        notifyError(error);
      }
    },
    [
      sourceCodeVersion.id,
      ikApi,
      selectedReferenceId,
      navigate,
      linkPrefix,
      originalConfigMap,
      sourceConfigMap,
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
            <>
              <ReferenceSelector />
              <ConfigList control={control} fields={fields} />
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
