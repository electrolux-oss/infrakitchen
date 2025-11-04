import { useState, useEffect } from "react";

import { CircularProgress } from "@mui/material";

import { useConfig } from "../../common";
import { HclItemList } from "../../common/components/HclItemList";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { notifyError } from "../../common/hooks/useNotification";
import { SourceCodeVersionResponse, SourceConfigResponse } from "../types";

export interface SourceCodeVersionParametersProps {
  source_code_version: SourceCodeVersionResponse;
}

export const SourceCodeVersionParameters = ({
  source_code_version,
}: SourceCodeVersionParametersProps) => {
  const { ikApi } = useConfig();
  const [configs, setConfigs] = useState<SourceConfigResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        setLoading(true);

        const configsResponse = await ikApi.get(
          `source_code_versions/${source_code_version.id}/configs`,
        );

        setConfigs(configsResponse);
      } catch (error: any) {
        notifyError(error);
      } finally {
        setLoading(false);
      }
    };

    if (source_code_version?.id) {
      fetchConfigs();
    }
  }, [source_code_version?.id, ikApi]);

  return (
    <>
      <PropertyCollapseCard
        title={`Input Variables (${configs?.length || 0})`}
        expanded={true}
        id="source-code-version-inputs"
      >
        {loading ? (
          <CircularProgress size={16} />
        ) : (
          <HclItemList items={configs} type="variables" />
        )}
      </PropertyCollapseCard>
      <PropertyCollapseCard
        title={`Output Values (${source_code_version.outputs?.length || 0})`}
        expanded={true}
        id="source-code-version-outputs"
      >
        {loading ? (
          <CircularProgress size={16} />
        ) : (
          <HclItemList items={source_code_version.outputs} type="outputs" />
        )}
      </PropertyCollapseCard>
    </>
  );
};
