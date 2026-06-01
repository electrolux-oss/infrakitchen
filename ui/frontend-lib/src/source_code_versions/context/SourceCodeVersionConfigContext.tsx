import {
  useState,
  useCallback,
  useContext,
  createContext,
  ReactNode,
  useEffect,
} from "react";

import { useEffectOnce } from "react-use";

import { InfraKitchenApi } from "../../api";
import { TreeResponse } from "../../common/components/tree/types";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  GqlTemplateTreeNode,
  transformTemplateTreeNode,
} from "../../templates/graphql";
import { TemplateShort } from "../../templates/types";
import { ValidationRule } from "../../types";
import {
  GqlValidationRulesByVariable,
  GqlValidationRule,
  transformValidationRulesByVariable,
} from "../../validation_rules/graphql";
import {
  SOURCE_CODE_VERSION_CONFIGS_QUERY,
  SOURCE_CODE_VERSION_CONFIGS_WITH_VALIDATION_QUERY,
  SOURCE_CODE_VERSION_CONFIG_PAGE_QUERY,
  GqlSourceConfig,
  GqlSourceCodeVersion,
  GqlSourceConfigTemplateReference,
  transformSourceConfig,
  transformSourceConfigTemplateReference,
  transformSourceCodeVersion,
} from "../graphql";
import {
  SourceConfigResponse,
  SourceCodeVersionResponse,
  SourceConfigTemplateReferenceResponse,
} from "../types";

interface SourceCodeVersionConfigContextType {
  references: SourceCodeVersionResponse[];
  selectedReferenceId: string;
  sourceCodeVersion: SourceCodeVersionResponse;
  sourceConfigs: SourceConfigResponse[];
  templates: TemplateShort[];
  templateReferences: SourceConfigTemplateReferenceResponse[];
  validationRulesCatalog: ValidationRule[];
  refetchConfigs: () => void;
  handleReferenceChange: (newReferenceId: string) => void;
  isLoading: boolean;
}

export const SourceCodeVersionConfigContext = createContext<
  SourceCodeVersionConfigContextType | undefined
>(undefined);

interface SourceCodeVersionConfigProviderProps {
  children: ReactNode;
  ikApi: InfraKitchenApi;
  sourceCodeVersion: SourceCodeVersionResponse;
}

function flattenTemplates(
  tree: TreeResponse,
  templates: TemplateShort[] = [],
): TemplateShort[] {
  if (!tree) {
    return templates;
  }
  if (tree.id) {
    templates.push({
      id: tree.id,
      name: tree.name,
      abstract: false, // Not provided in the tree response, assuming false as default
      _entity_name: "template",
    });
  }
  if (tree.children && tree.children.length > 0) {
    tree.children.forEach((child) => {
      flattenTemplates(child, templates);
    });
  }
  return templates;
}

export const SourceCodeVersionConfigProvider = ({
  children,
  ikApi,
  sourceCodeVersion,
}: SourceCodeVersionConfigProviderProps) => {
  const [references, setReferences] = useState<SourceCodeVersionResponse[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string>("");
  const [templates, setTemplates] = useState<TemplateShort[]>([]);
  const [tree, setTree] = useState<TreeResponse>();
  const [templateReferences, setTemplateReferences] = useState<
    SourceConfigTemplateReferenceResponse[]
  >([]);
  const [sourceConfigs, setSourceConfigs] = useState<SourceConfigResponse[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [validationRulesCatalog, setValidationRulesCatalog] = useState<
    ValidationRule[]
  >([]);

  const applyValidationRules = useCallback(
    (
      configs: SourceConfigResponse[],
      validationRulesResponse: {
        variable_name: string;
        rules: ValidationRule[];
      }[],
    ): SourceConfigResponse[] => {
      const validationRulesMap = new Map<
        string,
        {
          id?: string;
          regex_pattern?: string | null;
          min_value?: string | number | null;
          max_value?: string | number | null;
        }
      >();

      validationRulesResponse.forEach(({ variable_name, rules }) => {
        if (!rules || rules.length === 0) {
          return;
        }

        const preferredRule =
          rules.find((rule) => {
            const hasRegex = Boolean(rule.regex_pattern?.trim().length);
            const hasMin =
              rule.min_value !== undefined && rule.min_value !== null;
            const hasMax =
              rule.max_value !== undefined && rule.max_value !== null;
            return hasRegex || hasMin || hasMax;
          }) || rules[0];

        const hasMin =
          preferredRule.min_value !== undefined &&
          preferredRule.min_value !== null;
        const hasMax =
          preferredRule.max_value !== undefined &&
          preferredRule.max_value !== null;

        validationRulesMap.set(variable_name, {
          id: preferredRule.id,
          regex_pattern: preferredRule.regex_pattern,
          min_value: hasMin ? preferredRule.min_value : null,
          max_value: hasMax ? preferredRule.max_value : null,
        });
      });

      return configs.map((config) => {
        const validationRule = validationRulesMap.get(config.name);
        return {
          ...config,
          validation_rule_id: validationRule?.id ?? null,
          validation_regex: validationRule?.regex_pattern || "",
          validation_min_value: validationRule?.min_value ?? null,
          validation_max_value: validationRule?.max_value ?? null,
        };
      });
    },
    [],
  );

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const gqlResponse = await ikApi.graphqlRequest<{
        sourceCodeVersionConfigs: GqlSourceConfig[];
        validationRulesByTemplate: GqlValidationRulesByVariable[];
        predefinedValidationRules: GqlValidationRule[];
        templateTree: GqlTemplateTreeNode | null;
        sourceCodeVersionTemplateReferences: GqlSourceConfigTemplateReference[];
        sourceCodeVersions: GqlSourceCodeVersion[];
      }>(SOURCE_CODE_VERSION_CONFIG_PAGE_QUERY, {
        sourceCodeVersionId: sourceCodeVersion.id,
        templateId: sourceCodeVersion.template.id,
        refsFilter: { template_id: sourceCodeVersion.template.id },
        refsSort: ["source_code_folder", "ASC"],
        refsRange: [0, 999],
      });

      // Configs + validation rules
      const configsResponse = gqlResponse.sourceCodeVersionConfigs.map(
        transformSourceConfig,
      );
      if (configsResponse.length > 0) {
        const validationRulesResponse =
          gqlResponse.validationRulesByTemplate.map(
            transformValidationRulesByVariable,
          );
        setSourceConfigs(
          applyValidationRules(configsResponse, validationRulesResponse),
        );
      } else {
        notify("No source code configs found", "info");
      }

      // Validation rules catalog
      const rules: ValidationRule[] = gqlResponse.predefinedValidationRules.map(
        (r) => ({
          id: r.id ?? undefined,
          target_type: r.targetType as ValidationRule["target_type"],
          description: r.description,
          min_value: r.minValue,
          max_value: r.maxValue,
          regex_pattern: r.regexPattern,
          max_length: r.maxLength,
        }),
      );
      setValidationRulesCatalog(rules);

      // Template tree
      if (gqlResponse.templateTree) {
        setTree(transformTemplateTreeNode(gqlResponse.templateTree));
      }

      // Template references
      const refs = gqlResponse.sourceCodeVersionTemplateReferences.map(
        transformSourceConfigTemplateReference,
      );
      if (refs.length > 0) {
        setTemplateReferences(refs);
      }

      // SCV references
      const scvRefs = gqlResponse.sourceCodeVersions.map(
        transformSourceCodeVersion,
      );
      setReferences(scvRefs.filter((ref) => ref.id !== sourceCodeVersion.id));
    } catch (error: any) {
      notifyError(error);
    } finally {
      setIsLoading(false);
    }
  }, [
    ikApi,
    sourceCodeVersion.id,
    sourceCodeVersion.template.id,
    applyValidationRules,
  ]);

  const fetchSourceConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const configsGqlResponse = await ikApi.graphqlRequest<{
        sourceCodeVersionConfigs: GqlSourceConfig[];
        validationRulesByTemplate: GqlValidationRulesByVariable[];
      }>(SOURCE_CODE_VERSION_CONFIGS_WITH_VALIDATION_QUERY, {
        sourceCodeVersionId: sourceCodeVersion.id,
        templateId: sourceCodeVersion.template.id,
      });

      const configsResponse = configsGqlResponse.sourceCodeVersionConfigs.map(
        transformSourceConfig,
      );
      if (configsResponse.length > 0) {
        const validationRulesResponse =
          configsGqlResponse.validationRulesByTemplate.map(
            transformValidationRulesByVariable,
          );
        setSourceConfigs(
          applyValidationRules(configsResponse, validationRulesResponse),
        );
      } else {
        notify("No source code configs found", "info");
      }
    } catch (error: any) {
      notifyError(error);
    } finally {
      setIsLoading(false);
    }
  }, [
    ikApi,
    sourceCodeVersion.id,
    sourceCodeVersion.template.id,
    applyValidationRules,
  ]);

  const updateConfigsValuesWithReference = useCallback(
    (
      existingConfigs: SourceConfigResponse[],
      referenced_configs: SourceConfigResponse[],
    ) => {
      const updatedConfigs: SourceConfigResponse[] = existingConfigs.map(
        (existingConfig) => {
          const matchingRefConfig = referenced_configs.find(
            (c) => c.name === existingConfig.name,
          );

          if (matchingRefConfig) {
            return {
              ...existingConfig,
              default: matchingRefConfig.default,
              required: matchingRefConfig.required,
              frozen: matchingRefConfig.frozen,
              unique: matchingRefConfig.unique,
              options: matchingRefConfig.options,
            };
          }
          return existingConfig;
        },
      );

      return updatedConfigs;
    },
    [],
  );

  const fetchReferenceSourceConfigs = useCallback(
    (scv_id: string) => {
      ikApi
        .graphqlRequest<{
          sourceCodeVersionConfigs: GqlSourceConfig[];
        }>(SOURCE_CODE_VERSION_CONFIGS_QUERY, {
          sourceCodeVersionId: scv_id,
        })
        .then((gqlResponse) => {
          const response = gqlResponse.sourceCodeVersionConfigs.map(
            transformSourceConfig,
          );
          if (response.length > 0) {
            setSourceConfigs((currentSourceConfigs) => {
              return updateConfigsValuesWithReference(
                currentSourceConfigs,
                response,
              );
            });
          } else {
            notify(
              "No source code configs found for the selected reference",
              "info",
            );
          }
        })
        .catch((error: Error) => {
          notifyError(error);
        });
    },
    [ikApi, updateConfigsValuesWithReference],
  );

  useEffect(() => {
    if (selectedReferenceId) {
      fetchReferenceSourceConfigs(selectedReferenceId);
    }
  }, [selectedReferenceId, fetchReferenceSourceConfigs]);

  useEffect(() => {
    if (tree) {
      const flattenedTemplates = flattenTemplates(tree);
      const uniqueTemplates = Array.from(
        new Map(flattenedTemplates.map((t) => [t.id, t])).values(),
      );

      setTemplates(
        uniqueTemplates
          .filter((t) => t.id !== sourceCodeVersion.template.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
  }, [tree, sourceCodeVersion.template.id]);

  useEffectOnce(() => {
    fetchAllData();
  });

  const handleReferenceChange = useCallback((newReferenceId: string) => {
    setSelectedReferenceId(newReferenceId);
  }, []);

  const value: SourceCodeVersionConfigContextType = {
    references,
    selectedReferenceId,
    sourceCodeVersion,
    sourceConfigs,
    templates,
    templateReferences,
    validationRulesCatalog,
    refetchConfigs: fetchSourceConfigs,
    handleReferenceChange,
    isLoading,
  };

  return (
    <SourceCodeVersionConfigContext.Provider value={value}>
      {children}
    </SourceCodeVersionConfigContext.Provider>
  );
};

export const useSourceCodeVersionConfigContext = () => {
  const context = useContext(SourceCodeVersionConfigContext);
  if (context === undefined) {
    throw new Error(
      "useSourceCodeVersionConfigContext must be used within a SourceCodeVersionConfigProvider",
    );
  }
  return context;
};
