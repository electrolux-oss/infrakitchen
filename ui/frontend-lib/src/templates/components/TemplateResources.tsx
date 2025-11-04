import { useState, useCallback, useEffect } from "react";

import { Box, Typography } from "@mui/material";

import { GradientCircularProgress } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { ResourceResponse } from "../../resources/types";

interface TemplateResourcesProps {
  template_id: string;
}
export const TemplateResources = (props: TemplateResourcesProps) => {
  const { template_id } = props;
  const { ikApi } = useConfig();
  const [resources, setResources] = useState<ResourceResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRelatedData = useCallback(async () => {
    if (!template_id) return;
    setLoading(true);
    ikApi
      .getList("resources", {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "updated_at", order: "DESC" },
        filter: { template_id: template_id },
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
  }, [ikApi, template_id]);

  useEffect(() => {
    fetchRelatedData();
  }, [fetchRelatedData]);

  if (!template_id) return null;

  return (
    <PropertyCollapseCard
      id="template-resources"
      title="Resources"
      subtitle="Resources provisioned (or to be provisioned) from this template"
    >
      {loading && <GradientCircularProgress />}
      {resources.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No resources provisioned from this template.
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
            alignItems: "center",
            width: "95%",
          }}
        >
          <Box sx={{ minWidth: 0, flexGrow: 1, pr: 4 }}>
            <Typography variant="body1" fontWeight={500}>
              <GetEntityLink {...r} />
            </Typography>
          </Box>
          <Box sx={{ flexShrink: 0 }}>
            <StatusChip status={r.status} state={r.state} />
          </Box>
        </Box>
      ))}
    </PropertyCollapseCard>
  );
};
