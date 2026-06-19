import { useEffect, useState } from "react";

import { CircularProgress, Box } from "@mui/material";

import { useConfig } from "../../common";
import { HclItemList } from "../../common/components/HclItemList";
import { notifyError } from "../../common/hooks/useNotification";
import { ValidationRulesByVariable } from "../../types";
import {
  GqlValidationRulesByVariable,
  transformValidationRulesByVariable,
} from "../../validation_rules/graphql";
import {
  GqlSourceConfig,
  SOURCE_CODE_VERSION_CONFIGS_WITH_VALIDATION_QUERY,
  SOURCE_CODE_VERSION_CONFIGS_QUERY,
  GqlSourceCodeVersion,
} from "../graphql";
import { SourceConfigResponse } from "../types";

function applyValidationRules(
  configs: SourceConfigResponse[],
  validationRules: ValidationRulesByVariable[],
): SourceConfigResponse[] {
  const rulesMap = new Map<
    string,
    ValidationRulesByVariable["rules"][number]
  >();
  validationRules.forEach(({ variable_name, rules }) => {
    if (rules?.length) {
      rulesMap.set(variable_name, rules[0]);
    }
  });

  return configs.map((config) => {
    const rule = rulesMap.get(config.name);
    if (!rule) return config;
    return {
      ...config,
      validationRuleId: config.validationRuleId ?? rule.id ?? null,
      validationRegex: config.validationRegex || rule.regex_pattern || "",
      validationMinValue: config.validationMinValue ?? rule.min_value ?? null,
      validationMaxValue: config.validationMaxValue ?? rule.max_value ?? null,
    };
  });
}

type InputTabProps = {
  source_code_version: GqlSourceCodeVersion;
};

export const InputTab = ({ source_code_version }: InputTabProps) => {
  const { ikApi } = useConfig();
  const [configs, setConfigs] = useState<SourceConfigResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfigs = async () => {
      if (!source_code_version?.id) {
        return;
      }

      try {
        setLoading(true);

        const hasTemplate = Boolean(source_code_version?.template?.id);

        if (hasTemplate) {
          const response = await ikApi.graphqlRequest<{
            sourceCodeVersionConfigs: GqlSourceConfig[];
            validationRulesByTemplate: GqlValidationRulesByVariable[];
          }>(SOURCE_CODE_VERSION_CONFIGS_WITH_VALIDATION_QUERY, {
            sourceCodeVersionId: source_code_version.id,
            templateId: source_code_version.template!.id,
          });

          const configsResponse = response.sourceCodeVersionConfigs || [];

          const validationRulesResponse = (
            response.validationRulesByTemplate || []
          ).map(transformValidationRulesByVariable);

          setConfigs(
            applyValidationRules(configsResponse, validationRulesResponse),
          );
        } else {
          const response = await ikApi.graphqlRequest<{
            sourceCodeVersionConfigs: GqlSourceConfig[];
          }>(SOURCE_CODE_VERSION_CONFIGS_QUERY, {
            sourceCodeVersionId: source_code_version.id,
          });

          setConfigs(response.sourceCodeVersionConfigs || []);
        }
      } catch (error: any) {
        notifyError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, [
    source_code_version?.id,
    source_code_version?.template?.id,
    ikApi,
    source_code_version.template,
  ]);

  return (
    <Box sx={{ pt: 0.5 }}>
      {loading ? (
        <CircularProgress size={16} />
      ) : (
        <HclItemList items={configs} type="variables" />
      )}
    </Box>
  );
};
