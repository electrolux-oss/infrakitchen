import { useMemo } from "react";

import { Box, CircularProgress, FormControl, MenuItem, Select, Typography } from "@mui/material";

import { WiringDiagram } from "../../common/components/viewers/Wiring/WiringDiagram";

import { type ProvisionedResource } from "./ProvisionedResource.types";
import { mapResourcesToGraphModel } from "./resourceGraphMapper";
import { useResourceWiringData } from "./UseResourceWiringData";

interface ResourceWiringDiagramProps {
  resources?: ProvisionedResource[];
  templateId?: string;
  scvId?: string;
  showVersionSelector?: boolean;
  height?: number;
  allowFullscreen?: boolean;
}

export const ResourceWiringDiagram = ({
  resources,
  templateId,
  scvId,
  showVersionSelector = false,
  height,
  allowFullscreen,
}: ResourceWiringDiagramProps) => {
  const {
    isTemplateViewerMode,
    versions,
    selectedVersionId,
    setSelectedVersionId,
    loadingVersions,
    loadingResources,
    effectiveResources,
  } = useResourceWiringData({
    resources,
    templateId,
    scvId,
    showVersionSelector,
  });

  const { templates, wiring, externalTemplates } = useMemo(
    () => mapResourcesToGraphModel(effectiveResources),
    [effectiveResources],
  );

  if (isTemplateViewerMode && loadingVersions) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (isTemplateViewerMode && versions.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2 }}>
        No source code versions linked to this template yet.
      </Typography>
    );
  }

  if (isTemplateViewerMode) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <FormControl size="small">
            <Select
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              {versions.map((version) => (
                <MenuItem key={version.id} value={version.id}>
                  {version.identifier}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {effectiveResources.length === 0 ? (
          <Box
            sx={{
              minHeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {loadingResources ? (
              <CircularProgress size={24} />
            ) : (
              <Typography color="text.secondary">
                No resources found in this version.
              </Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ position: "relative" }}>
            <WiringDiagram
              templates={templates}
              wiring={wiring}
              externalTemplates={externalTemplates}
              constants={[]}
              height={height}
              allowFullscreen={allowFullscreen}
              compactNodes
              layoutDirection="top-to-bottom"
            />
            {loadingResources && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "rgba(255,255,255,0.35)",
                  backdropFilter: "blur(1px)",
                  pointerEvents: "none",
                }}
              >
                <CircularProgress size={22} />
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  }

  if (effectiveResources.length === 0) {
    return (
      <Typography color="text.secondary">No resources to display.</Typography>
    );
  }

  return (
    <WiringDiagram
      templates={templates}
      wiring={wiring}
      externalTemplates={externalTemplates}
      constants={[]}
      height={height}
      allowFullscreen={allowFullscreen}
      compactNodes
      layoutDirection="top-to-bottom"
    />
  );
};
