import { useState, useCallback, useEffect } from "react";

import { Box, Typography, Chip } from "@mui/material";

import { GradientCircularProgress } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import { WorkspaceResponse } from "../../workspaces/types";

interface IntegrationWorkspaceDependenciesProps {
  integration_id: string;
}

export const IntegrationWorkspaceDependencies = (
  props: IntegrationWorkspaceDependenciesProps,
) => {
  const { integration_id } = props;
  const { ikApi } = useConfig();
  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRelatedData = useCallback(async () => {
    if (!integration_id) return;
    setLoading(true);
    ikApi
      .getList("workspaces", {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "updated_at", order: "DESC" },
        filter: { integration_id: integration_id },
      })
      .then((response) => {
        setWorkspaces(response.data || []);
      })
      .catch((e) => {
        notifyError(e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ikApi, integration_id]);

  useEffect(() => {
    fetchRelatedData();
  }, [fetchRelatedData]);

  if (!integration_id) return null;

  return (
    <PropertyCollapseCard
      id={`integration-workspace-dependencies`}
      title="Workspaces"
      subtitle="Workspaces published with this integration"
    >
      {loading && <GradientCircularProgress />}
      {workspaces.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No dependencies for this integration.
        </Typography>
      )}
      {workspaces.map((r) => (
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
