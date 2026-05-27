import { useEffect, useState } from "react";

import { useConfig } from "../../common/context/ConfigContext";
import { ENTITY_STATUS } from "../../utils";

import { type ProvisionedResource } from "./ProvisionedResource.types";

interface SourceCodeVersion {
  id: string;
  identifier: string;
  source_code: { source_code_url: string };
}

interface UseResourceWiringDataParams {
  resources?: ProvisionedResource[];
  templateId?: string;
  scvId?: string;
  showVersionSelector?: boolean;
}

interface UseResourceWiringDataResult {
  isTemplateViewerMode: boolean;
  versions: SourceCodeVersion[];
  selectedVersionId: string;
  setSelectedVersionId: (id: string) => void;
  loadingVersions: boolean;
  loadingResources: boolean;
  effectiveResources: ProvisionedResource[];
}

export function useResourceWiringData({
  resources,
  templateId,
  scvId,
  showVersionSelector = false,
}: UseResourceWiringDataParams): UseResourceWiringDataResult {
  const { ikApi } = useConfig();
  const [fetchedResources, setFetchedResources] = useState<ProvisionedResource[]>(
    [],
  );
  const [versions, setVersions] = useState<SourceCodeVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);

  const isTemplateViewerMode = !resources && !!templateId && showVersionSelector;
  const effectiveVersionId = scvId || selectedVersionId;
  const effectiveResources = resources ?? fetchedResources;

  useEffect(() => {
    if (!isTemplateViewerMode || !templateId) {
      return;
    }

    setLoadingVersions(true);
    ikApi
      .getList("source_code_versions", {
        filter: {
          template_id: [templateId],
          status: ENTITY_STATUS.DONE,
        },
        pagination: { page: 1, perPage: 50 },
      })
      .then(({ data }) => {
        const list = data as SourceCodeVersion[];
        setVersions(list);
        if (list.length === 0) {
          setSelectedVersionId("");
          return;
        }

        setSelectedVersionId((current) => {
          const exists = list.some((item) => item.id === current);
          return exists ? current : list[0].id;
        });
      })
      .finally(() => setLoadingVersions(false));
  }, [isTemplateViewerMode, templateId, ikApi]);

  useEffect(() => {
    if (resources) {
      return;
    }

    if (!effectiveVersionId) {
      setFetchedResources([]);
      return;
    }

    setLoadingResources(true);
    ikApi
      .get(`source_code_versions/${effectiveVersionId}/resources`)
      .then((res) => setFetchedResources(res as ProvisionedResource[]))
      .finally(() => setLoadingResources(false));
  }, [resources, effectiveVersionId, ikApi]);

  return {
    isTemplateViewerMode,
    versions,
    selectedVersionId,
    setSelectedVersionId,
    loadingVersions,
    loadingResources,
    effectiveResources,
  };
}
