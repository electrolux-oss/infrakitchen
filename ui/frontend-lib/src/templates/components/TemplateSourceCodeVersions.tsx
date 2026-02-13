import { useState, useCallback, useEffect } from "react";

import { Box, Typography, Chip } from "@mui/material";

import { GradientCircularProgress, useLocalStorage } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { SourceCodeVersionResponse } from "../../source_code_versions/types";

interface TemplateSourceCodeVersionsProps {
  template_id: string;
}
export const TemplateSourceCodeVersions = (
  props: TemplateSourceCodeVersionsProps,
) => {
  const { template_id } = props;
  const { ikApi } = useConfig();
  const [scv, setScv] = useState<SourceCodeVersionResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const { value } = useLocalStorage<{
    expanded?: Record<string, boolean>;
  }>();

  const expandedMap = value.expanded ?? {};
  const isExpanded = expandedMap["template-versions"];

  const fetchRelatedData = useCallback(async () => {
    if (!template_id) return;
    if (!isExpanded) return;
    setLoading(true);
    ikApi
      .getList("source_code_versions", {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "updated_at", order: "DESC" },
        filter: { template_id: template_id },
        fields: [
          "id",
          "source_code_version",
          "source_code_branch",
          "source_code_folder",
          "description",
          "status",
          "labels",
        ],
      })
      .then((response) => {
        setScv(response.data || []);
      })
      .catch((e) => {
        notifyError(e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ikApi, template_id, isExpanded]);

  useEffect(() => {
    fetchRelatedData();
  }, [fetchRelatedData]);

  if (!template_id) return null;

  return (
    <PropertyCollapseCard
      id="template-versions"
      title="Versions"
      subtitle="Versions associated with this template"
    >
      {loading && <GradientCircularProgress />}
      {scv.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No resources for this template.
        </Typography>
      )}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {scv.map((version) => (
          <Box
            key={version.id}
            sx={{
              border: 1,
              borderColor: "divider",
              p: 2,
              mb: 2,
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              width: "95%",
            }}
          >
            <Box sx={{ minWidth: 0, flexGrow: 1, pr: 4 }}>
              <Typography
                variant="body1"
                component="span"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <GetEntityLink
                  {...{
                    id: version.id,
                    _entity_name: version._entity_name,
                    name: version.source_code_version
                      ? `Tag: ${version.source_code_version}, Path: ${version.source_code_folder}`
                      : `Branch: ${version.source_code_branch}, Path: ${version.source_code_folder}`,
                  }}
                />
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {version.description}
              </Typography>
              {version.labels?.slice(0, 4).map((l) => (
                <Chip key={l} size="small" label={l} variant="outlined" />
              ))}
            </Box>

            <Box sx={{ flexShrink: 0 }}>
              <StatusChip status={version.status} />
            </Box>
          </Box>
        ))}
      </Box>
    </PropertyCollapseCard>
  );
};
