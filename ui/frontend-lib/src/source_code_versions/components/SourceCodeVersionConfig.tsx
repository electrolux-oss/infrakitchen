import { useCallback, useEffect, useMemo } from "react";

import { Control, useFieldArray, useFormContext } from "react-hook-form";

import { Box, Alert, Button, CircularProgress } from "@mui/material";

import { useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { ENTITY_STATUS } from "../../utils";
import { REPLACE_VALIDATION_RULES_MUTATION } from "../../validation_rules/graphql";
import { useSourceCodeVersionConfigContext } from "../context/SourceCodeVersionConfigContext";
import { SourceConfigUpdateWithId } from "../types";
import { normalizeNumericField, parseNumericField } from "../utils/numeric";

import { ConfigList } from "./ConfigList";
import { ReferenceSelector } from "./ReferenceSelector";

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
  validationRuleId: string | null;
  validationRegex: string;
  validationMinValue: string;
  validationMaxValue: string;
  validationEnabled: boolean;
  referenceTemplateId: string | null;
  outputConfigName: string | null;
}

type ValidationRuleUpdate =
  | {
      action: "upsert";
      targetType: "string" | "number";
      ruleId?: string | null;
      regexPattern?: string | null;
      minValue?: number | null;
      maxValue?: number | null;
    }
  | {
      action: "clear";
      targetType: "string" | "number";
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
    formConfig.referenceTemplateId !== original.referenceTemplateId ||
    formConfig.outputConfigName !== original.outputConfigName ||
    formConfig.validationRuleId !== original.validationRuleId ||
    (formConfig.validationRegex || "") !== (original.validationRegex || "") ||
    normalizeNumericField(formConfig.validationMinValue) !==
      normalizeNumericField(original.validationMinValue) ||
    normalizeNumericField(formConfig.validationMaxValue) !==
      normalizeNumericField(original.validationMaxValue) ||
    Boolean(formConfig.validationEnabled) !==
      Boolean(original.validationEnabled)
  );
};

const buildValidationRuleUpdate = (
  config: SourceConfigUpdateWithId,
  sourceConfig: { type: string },
  ruleIdForSubmission: string | null,
  original?: ConfigSnapshot,
): ValidationRuleUpdate | null => {
  const targetType = sourceConfig.type === "number" ? "number" : "string";
  const trimmedRegex = (config.validationRegex || "").trim();
  const normalizedMin = parseNumericField(config.validationMinValue);
  const normalizedMax = parseNumericField(config.validationMaxValue);
  const wantsValidation = Boolean(config.validationEnabled);

  const hasConstraints =
    wantsValidation &&
    (Boolean(trimmedRegex) || normalizedMin !== null || normalizedMax !== null);

  const originalTrimmedRegex = (original?.validationRegex || "").trim();
  const originalMin = parseNumericField(original?.validationMinValue);
  const originalMax = parseNumericField(original?.validationMaxValue);
  const originalWantsValidation = Boolean(original?.validationEnabled);
  const originalHasConstraints =
    originalWantsValidation &&
    (Boolean(originalTrimmedRegex) ||
      originalMin !== null ||
      originalMax !== null);

  if (hasConstraints) {
    return {
      action: "upsert",
      targetType,
      ruleId: ruleIdForSubmission,
      regexPattern:
        targetType === "string" && trimmedRegex ? trimmedRegex : null,
      minValue:
        targetType === "number" && normalizedMin !== null
          ? normalizedMin
          : null,
      maxValue:
        targetType === "number" && normalizedMax !== null
          ? normalizedMax
          : null,
    };
  }

  if (originalHasConstraints) {
    return {
      action: "clear",
      targetType,
    };
  }

  return null;
};

const hasValidationData = (config: {
  validationRegex?: string | null;
  validationMinValue?: string | number | null;
  validationMaxValue?: string | number | null;
  validationRuleId?: string | null;
}): boolean => {
  const regexValue =
    typeof config.validationRegex === "string"
      ? config.validationRegex
      : config.validationRegex
        ? String(config.validationRegex)
        : "";
  const hasRegex = regexValue.trim().length > 0;
  const hasMin =
    config.validationMinValue !== null &&
    config.validationMinValue !== undefined &&
    config.validationMinValue !== "";
  const hasMax =
    config.validationMaxValue !== null &&
    config.validationMaxValue !== undefined &&
    config.validationMaxValue !== "";
  const hasReference = Boolean(config.validationRuleId);

  return hasRegex || hasMin || hasMax || hasReference;
};

export const SourceCodeVersionConfig = () => {
  const { ikApi } = useConfig();

  const {
    sourceConfigs,
    templateReferences,
    sourceCodeVersion,
    selectedReferenceId,
    isLoading,
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
          reference.inputConfigName,
          {
            referenceTemplateId: reference.referenceTemplateId || null,
            outputConfigName: reference.outputConfigName || null,
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
          validationRuleId: config.validationRuleId ?? null,
          validationRegex: config.validationRegex || "",
          validationMinValue: normalizeNumericField(config.validationMinValue),
          validationMaxValue: normalizeNumericField(config.validationMaxValue),
          validationEnabled: hasValidationData(config),
          referenceTemplateId: templateReference?.referenceTemplateId || null,
          outputConfigName: templateReference?.outputConfigName || null,
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
        const normalizedMin = normalizeNumericField(config.validationMinValue);
        const normalizedMax = normalizeNumericField(config.validationMaxValue);

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
          validationRuleId: config.validationRuleId ?? null,
          validationRegex: config.validationRegex || "",
          validationMinValue: normalizedMin,
          validationMaxValue: normalizedMax,
          validationEnabled: hasValidationData(config),
          referenceTemplateId: templateReference?.referenceTemplateId || null,
          outputConfigName: templateReference?.outputConfigName || null,
        };
      });
      reset({ configs: formattedConfigs });
    }
  }, [sourceConfigs, templateReferenceMap, reset]);

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
              ? (config.validationRuleId ?? null)
              : null;

          configUpdates.push({
            id: config.id,
            required: config.required,
            default: config.default,
            frozen: config.frozen,
            unique: config.unique,
            restricted: config.restricted,
            options: config.options,
            templateId: sourceCodeVersion.template.id,
            referenceTemplateId: config.referenceTemplateId,
            outputConfigName: config.outputConfigName,
            validationRuleId: ruleIdForSubmission,
            validationEnabled: config.validationEnabled,
            validationRegex: config.validationRegex || "",
            validationMinValue: normalizeNumericField(
              config.validationMinValue,
            ),
            validationMaxValue: normalizeNumericField(
              config.validationMaxValue,
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
          const rules =
            validationData.action === "clear"
              ? []
              : [
                  {
                    ...(validationData.ruleId
                      ? { id: validationData.ruleId }
                      : {}),
                    ...(validationData.regexPattern
                      ? { regexPattern: validationData.regexPattern }
                      : {}),
                    ...(validationData.minValue !== null &&
                    validationData.minValue !== undefined
                      ? { minValue: validationData.minValue }
                      : {}),
                    ...(validationData.maxValue !== null &&
                    validationData.maxValue !== undefined
                      ? { maxValue: validationData.maxValue }
                      : {}),
                    targetType:
                      validationData.targetType === "string"
                        ? "STRING"
                        : "NUMBER",
                  },
                ];

          await ikApi.graphqlRequest(REPLACE_VALIDATION_RULES_MUTATION, {
            templateId: sourceCodeVersion.template.id,
            variableName,
            rules,
          });
        }

        notify("Configurations updated successfully", "success");
      } catch (error: any) {
        notifyError(error);
      }
    },
    [
      sourceCodeVersion.id,
      ikApi,
      selectedReferenceId,
      originalConfigMap,
      sourceConfigMap,
      sourceCodeVersion.template.id,
    ],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", pt: 1 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          {sourceCodeVersion && (
            <>
              {sourceCodeVersion.status !== ENTITY_STATUS.DONE && (
                <Alert severity="warning">
                  Configurations can only be managed when the source code
                  version is in the &quot;done&quot; state.
                </Alert>
              )}
              {sourceCodeVersion.status === ENTITY_STATUS.DONE &&
                sourceCodeVersion.variables.length === 0 && (
                  <Alert severity="info">
                    This source code version has no variables.{" "}
                  </Alert>
                )}
            </>
          )}
        </Box>
        {sourceCodeVersion.status === ENTITY_STATUS.DONE &&
          sourceCodeVersion.variables.length > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <ReferenceSelector />
            </Box>
          )}
      </Box>

      {sourceCodeVersion.status === ENTITY_STATUS.DONE &&
        sourceCodeVersion.variables.length > 0 && (
          <>
            <ConfigList control={control as Control<any>} fields={fields} />
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                mt: 3,
              }}
            >
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit(onSubmit)}
              >
                Save
              </Button>
            </Box>
          </>
        )}
    </Box>
  );
};
