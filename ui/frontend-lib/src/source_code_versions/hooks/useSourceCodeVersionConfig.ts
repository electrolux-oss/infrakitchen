import { useState, useCallback, useEffect } from "react";

import { useEffectOnce } from "react-use";

import { notify, notifyError } from "../../common/hooks/useNotification";
import { SourceConfigResponse, SourceCodeVersionResponse } from "../types";

interface UseSourceCodeVersionConfigProps {
  ikApi: any;
  entity: SourceCodeVersionResponse;
}

export const useSourceCodeVersionConfig = ({
  ikApi,
  entity,
}: UseSourceCodeVersionConfigProps) => {
  const [references, setReferences] = useState<SourceCodeVersionResponse[]>([]);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string>("");
  const [sourceConfigs, setSourceConfigs] = useState<SourceConfigResponse[]>(
    [],
  );
  const [sourceCodeVersions, setSourceCodeVersions] = useState<
    SourceCodeVersionResponse[]
  >([]);

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
              reference: matchingRefConfig.reference,
            };
          }
          return existingConfig;
        },
      );

      return updatedConfigs;
    },
    [],
  );

  const fetchSourceConfigs = useCallback(() => {
    ikApi
      .get(`source_code_versions/${entity.id}/configs`)
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
  }, [ikApi, entity.id]);

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
        sort: { field: "identifier", order: "ASC" },
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
        setReferences(response.data);
      })
      .catch((error: Error) => {
        notifyError(error);
      });
  }, [ikApi]);

  const fetchSourceCodeVersions = useCallback(async () => {
    try {
      const response = await ikApi.get("source_code_versions");
      if (response.length > 0) {
        setSourceCodeVersions(response);
      } else {
        notify("No source code versions found", "info");
      }
    } catch (e) {
      notifyError(e);
    }
  }, [ikApi]);

  useEffectOnce(() => {
    fetchSourceConfigs();
    fetchSourceCodeVersions();
    fetchReferences();
  });

  useEffect(() => {
    if (selectedReferenceId) {
      fetchReferenceSourceConfigs(selectedReferenceId);
    }
  }, [selectedReferenceId, fetchReferenceSourceConfigs]);

  const handleReferenceChange = useCallback((newReferenceId: string) => {
    setSelectedReferenceId(newReferenceId);
  }, []);

  return {
    references,
    selectedReferenceId,
    sourceConfigs,
    sourceCodeVersions,
    handleReferenceChange,
  };
};
