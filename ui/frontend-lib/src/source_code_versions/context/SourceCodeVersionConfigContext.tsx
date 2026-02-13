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
import { TemplateShort } from "../../templates/types";
import { ValidationRule, ValidationRulesByVariable } from "../../types";
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

  const fetchSourceConfigs = useCallback(async () => {
    setIsLoading(true);
    try {
      const configsResponse: SourceConfigResponse[] = await ikApi.get(
        `source_code_versions/${sourceCodeVersion.id}/configs`,
      );

      if (configsResponse.length > 0) {
        const validationRulesResponse: ValidationRulesByVariable[] =
          await ikApi.get(
            `validation_rules/template/${sourceCodeVersion.template.id}`,
          );

        const validationRulesMap = new Map<
          string,
          {
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
            regex_pattern: preferredRule.regex_pattern,
            min_value: hasMin ? preferredRule.min_value : null,
            max_value: hasMax ? preferredRule.max_value : null,
          });
        });

        const configsWithValidation = configsResponse.map((config) => {
          const validationRule = validationRulesMap.get(config.name);
          return {
            ...config,
            validation_regex: validationRule?.regex_pattern || "",
            validation_min_value: validationRule?.min_value ?? null,
            validation_max_value: validationRule?.max_value ?? null,
          };
        });

        setSourceConfigs(configsWithValidation);
      } else {
        notify("No source code configs found", "info");
      }
    } catch (error: any) {
      notifyError(error);
    }
  }, [ikApi, sourceCodeVersion.id, sourceCodeVersion.template.id]);

  const fetchParentTemplates = useCallback(async () => {
    try {
      const response = await ikApi.get(
        `templates/${sourceCodeVersion.template.id}/tree/parents`,
      );
      if (response.id) {
        setTree(response);
      } else {
        notify("No templates found", "info");
      }
    } catch (e) {
      notifyError(e);
    }
  }, [ikApi, sourceCodeVersion.template.id]);

  const fetchTemplateReferences = useCallback(async () => {
    try {
      const response = await ikApi.get(
        `source_code_versions/template/${sourceCodeVersion.template.id}/references`,
      );
      if (response.length > 0) {
        setTemplateReferences(response);
      }
    } catch (e) {
      notifyError(e);
    }
  }, [ikApi, sourceCodeVersion.template.id]);

  const fetchValidationRulesCatalog = useCallback(async () => {
    try {
      const rules: ValidationRule[] = await ikApi.get(
        `validation_rules/predefined`,
      );
      setValidationRulesCatalog(rules);
    } catch (e) {
      notifyError(e);
    }
  }, [ikApi]);

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
        .get(`source_code_versions/${scv_id}/configs`)
        .then((response: SourceConfigResponse[]) => {
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

  const fetchReferences = useCallback(() => {
    ikApi
      .getList("source_code_versions", {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "source_code_folder", order: "ASC" },
        filter: { template_id: sourceCodeVersion.template.id },
        fields: [
          "id",
          "identifier",
          "template",
          "source_code",
          "status",
          "created_at",
        ],
      })
      .then((response: { data: SourceCodeVersionResponse[] }) => {
        setReferences(
          response.data.filter((ref) => ref.id !== sourceCodeVersion.id),
        );
      })
      .catch((error: Error) => {
        notifyError(error);
      });
  }, [ikApi, sourceCodeVersion.id, sourceCodeVersion.template.id]);

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
    Promise.all([
      fetchSourceConfigs(),
      fetchParentTemplates(),
      fetchTemplateReferences(),
      fetchReferences(),
      fetchValidationRulesCatalog(),
    ]).finally(() => setIsLoading(false));
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
