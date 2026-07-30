import { useState, useEffect } from "react";

import {
  Box,
  CircularProgress,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import { useConfig } from "../../common";
import { ResourceGraphTab } from "../../source_code_versions/components/ResourceGraphTab";

interface ScvSummary {
  id: string;
  identifier: string;
  source_code_folder: string;
  code_snapshot: string | null;
}

export const TemplateGraphTab = ({ templateId }: { templateId: string }) => {
  const { ikApi } = useConfig();
  const [versions, setVersions] = useState<ScvSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ikApi
      .graphqlRequest(
        `query Q($filter: JSON, $sort: [String!], $range: [Int!]) {
          sourceCodeVersions(filter: $filter, sort: $sort, range: $range) {
            id identifier sourceCodeFolder codeSnapshot
          }
        }`,
        {
          filter: { template_id: [templateId] },
          sort: ["created_at", "DESC"],
          range: [0, 50],
        },
      )
      .then((res: any) => {
        const items = (res?.sourceCodeVersions ?? []).map((v: any) => ({
          id: v.id,
          identifier: v.identifier,
          source_code_folder: v.sourceCodeFolder ?? "",
          code_snapshot: v.codeSnapshot ?? null,
        }));
        setVersions(items);
        if (items.length > 0) setSelectedId(items[0].id);
      })
      .finally(() => setLoading(false));
  }, [templateId, ikApi]);

  if (loading)
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  if (!versions.length)
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">
          No template versions found.
        </Typography>
      </Box>
    );

  const selected = versions.find((v) => v.id === selectedId) ?? versions[0];

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 0.5,
        }}
      >
        <Typography variant="h5" component="h2">
          Resource Plan
        </Typography>
        {versions.length > 1 && (
          <Select
            size="small"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            sx={{ minWidth: 260 }}
          >
            {versions.map((v) => (
              <MenuItem key={v.id} value={v.id}>
                {v.identifier}
              </MenuItem>
            ))}
          </Select>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Resources that are planned to be provisioned for this source code
        version.
      </Typography>
      <ResourceGraphTab
        codeSnapshot={selected.code_snapshot}
        sourceCodeFolder={selected.source_code_folder}
        hideHeader
      />
    </Box>
  );
};
