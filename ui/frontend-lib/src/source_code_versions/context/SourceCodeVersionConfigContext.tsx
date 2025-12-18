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
import {
  SourceConfigResponse,
  SourceCodeVersionResponse,
  SourceConfigTemplateReferenceResponse,
} from "../types";

interface SourceCodeVersionConfigContextType {
  sourceCodeVersion: SourceCodeVersionResponse;
  sourceConfigs: SourceConfigResponse[];
  templates: TemplateShort[];
  templateReferences: SourceConfigTemplateReferenceResponse[];
  refetchConfigs: () => void;
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
  const [templates, setTemplates] = useState<TemplateShort[]>([]);
  const [tree, setTree] = useState<TreeResponse>();
  const [templateReferences, setTemplateReferences] = useState<
    SourceConfigTemplateReferenceResponse[]
  >([]);
  const [sourceConfigs, setSourceConfigs] = useState<SourceConfigResponse[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchSourceConfigs = useCallback(() => {
    setIsLoading(true);
    ikApi
      .get(`source_code_versions/${sourceCodeVersion.id}/configs`)
      .then((response: SourceConfigResponse[]) => {
        if (response.length > 0) {
          setSourceConfigs(response);
        } else {
          notify("No source code configs found", "info");
        }
      })
      .catch((error: Error) => {
        notifyError(error);
      });
  }, [ikApi, sourceCodeVersion.id]);

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

  useEffect(() => {
    if (tree) {
      const flattenedTemplates = flattenTemplates(tree);
      setTemplates(
        flattenedTemplates
          .sort((a, b) => a.name.localeCompare(b.name))
          // Exclude the current template to prevent self-reference
          .filter((t) => t.id !== sourceCodeVersion.template.id),
      );
    }
  }, [tree, sourceCodeVersion.template.id]);

  useEffectOnce(() => {
    Promise.all([
      fetchSourceConfigs(),
      fetchParentTemplates(),
      fetchTemplateReferences(),
    ]).finally(() => setIsLoading(false));
  });

  const value: SourceCodeVersionConfigContextType = {
    sourceCodeVersion,
    sourceConfigs,
    templates,
    templateReferences,
    refetchConfigs: fetchSourceConfigs,
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
