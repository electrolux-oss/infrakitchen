import { useEffect, useState } from "react";

import { CircularProgress, Box } from "@mui/material";

import { useConfig } from "../../common";
import { HclItemList } from "../../common/components/HclItemList";
import { notifyError } from "../../common/hooks/useNotification";
import { ValidationRulesByVariable } from "../../types";
import { SourceCodeVersionResponse, SourceConfigResponse } from "../types";

type InputTabProps = {
  source_code_version: SourceCodeVersionResponse;
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
        const configsResponse: SourceConfigResponse[] = await ikApi.get(
          `source_code_versions/${source_code_version.id}/configs`,
        );

        let validationRulesResponse: ValidationRulesByVariable[] = [];
        if (source_code_version?.template?.id) {
          try {
            validationRulesResponse = await ikApi.get(
              `validation_rules/template/${source_code_version.template.id}`,
            );
          } catch (validationError: any) {
            notifyError(validationError);
          }
        }

        const validationRulesMap = new Map<
          string,
          ValidationRulesByVariable["rules"][number]
        >();
        validationRulesResponse.forEach(({ variable_name, rules }) => {
          if (!rules || rules.length === 0) {
            return;
          }

          validationRulesMap.set(variable_name, rules[0]);
        });

        const enrichedConfigs = configsResponse.map((config) => {
          const rule = validationRulesMap.get(config.name);
          if (!rule) {
            return config;
          }

          const existingRegex =
            typeof config.validation_regex === "string"
              ? config.validation_regex
              : config.validation_regex || "";

          return {
            ...config,
            validation_rule_id: config.validation_rule_id ?? rule.id ?? null,
            validation_regex: existingRegex || rule.regex_pattern || "",
            validation_min_value:
              config.validation_min_value ?? rule.min_value ?? null,
            validation_max_value:
              config.validation_max_value ?? rule.max_value ?? null,
          };
        });

        setConfigs(enrichedConfigs);
      } catch (error: any) {
        notifyError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, [source_code_version?.id, source_code_version?.template?.id, ikApi]);

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
