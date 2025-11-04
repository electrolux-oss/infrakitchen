import { useState, useCallback, useEffect } from "react";

import { Box, Typography, Chip } from "@mui/material";

import { GradientCircularProgress } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import { ResourceResponse } from "../../resources/types";

interface SourceCodeVersionResourcesProps {
  source_code_version_id: string;
}
export const SourceCodeVersionResources = (
  props: SourceCodeVersionResourcesProps,
) => {
  const { source_code_version_id } = props;
  const { ikApi } = useConfig();
  const [resources, setResources] = useState<ResourceResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRelatedData = useCallback(async () => {
    if (!source_code_version_id) return;
    setLoading(true);
    ikApi
      .getList("resources", {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "updated_at", order: "DESC" },
        filter: { source_code_version_id: source_code_version_id },
      })
      .then((response) => {
        setResources(response.data || []);
      })
      .catch((e) => {
        notifyError(e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ikApi, source_code_version_id]);

  useEffect(() => {
    fetchRelatedData();
  }, [fetchRelatedData]);

  if (!source_code_version_id) return null;

  return (
    <PropertyCollapseCard
      id="source_code_version-resources"
      title="Resources"
      subtitle="Instances published in this source_code_version"
    >
      {loading && <GradientCircularProgress />}
      {resources.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No resources for this source_code_version.
        </Typography>
      )}
      {resources.map((r) => (
        <Box
          key={r.id}
          sx={{
            border: 1,
            borderColor: "divider",
            p: 2,
            mb: 2,
            borderRadius: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
          }}
        >
          <Typography variant="body1" fontWeight={500}>
            <GetEntityLink {...r} />
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {r.description}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Chip size="small" label={r.state} />
            <Chip size="small" label={r.status} variant="outlined" />
            {r.labels?.slice(0, 4).map((l) => (
              <Chip key={l} size="small" label={l} variant="outlined" />
            ))}
          </Box>
        </Box>
      ))}
    </PropertyCollapseCard>
  );
};
