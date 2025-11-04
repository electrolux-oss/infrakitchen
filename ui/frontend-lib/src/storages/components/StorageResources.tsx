import { useState, useCallback, useEffect } from "react";

import { Box, Typography, Chip } from "@mui/material";

import { GradientCircularProgress } from "../../common";
import { GetEntityLink } from "../../common/components/CommonField";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import { ResourceResponse } from "../../resources/types";

interface StorageResourcesProps {
  storage_id: string;
}
export const StorageResources = (props: StorageResourcesProps) => {
  const { storage_id } = props;
  const { ikApi } = useConfig();
  const [resources, setResources] = useState<ResourceResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRelatedData = useCallback(async () => {
    if (!storage_id) return;
    setLoading(true);
    ikApi
      .getList("resources", {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "updated_at", order: "DESC" },
        filter: { storage_id: storage_id },
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
  }, [ikApi, storage_id]);

  useEffect(() => {
    fetchRelatedData();
  }, [fetchRelatedData]);

  if (!storage_id) return null;

  return (
    <PropertyCollapseCard
      id="storage-resources"
      title="Resources"
      subtitle="Instances published in this storage"
    >
      {loading && <GradientCircularProgress />}
      {resources.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No resources for this storage.
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
