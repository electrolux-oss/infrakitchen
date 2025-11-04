import { useState, useEffect } from "react";

import { json } from "@codemirror/lang-json";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Link as MuiLink,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  Typography,
} from "@mui/material";
import CodeMirror from "@uiw/react-codemirror";

import { useConfig } from "../../common";
import GradientCircularProgress from "../../common/GradientCircularProgress";
import { notifyError } from "../../common/hooks/useNotification";

import { AzureDevopsRepo } from "./types";

interface AzureDevopsRepoMetadataProps {
  organization: string;
  name: string;
  queryParams?: Record<string, string>;
}

export function AzureDevopsRepoMetadata(props: AzureDevopsRepoMetadataProps) {
  const { organization, name, queryParams } = props;

  const { ikApi } = useConfig();
  const [metadata, setMetadata] = useState<AzureDevopsRepo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const link = `provider/azure_devops/repos/${organization}/${name}`;

  useEffect(() => {
    setLoading(true);
    setError(null); // Clear previous errors
    ikApi
      .get(link, queryParams)
      .then((response: AzureDevopsRepo) => {
        // Cast response to AzureDevopsRepo
        setMetadata(response);
      })
      .catch((err: { message: string }) => {
        notifyError(err);
        setError(new Error(err.message));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ikApi, name, organization, link, queryParams]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <GradientCircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error.toString()}</Alert>
      </Box>
    );
  }

  if (!metadata) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          No repository information found for {organization}/{name}.
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100%",
        p: 3,
        maxWidth: "800px",
        mx: "auto",
        bgcolor: "background.paper",
        borderRadius: 2,
        boxShadow: 3,
      }}
    >
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{ mb: 2, color: "primary.main", fontWeight: "bold" }}
      >
        {metadata.name}
      </Typography>

      {metadata.description && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {metadata.description}
        </Typography>
      )}

      {/* Basic Info */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Chip
          label={`Default Branch: ${metadata.default_branch}`}
          variant="outlined"
        />
        {metadata.isDisabled && (
          <Chip label="Archived" variant="outlined" color="info" />
        )}
        {metadata.url && (
          <MuiLink
            href={metadata.url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ textDecoration: "none" }}
          >
            <Chip label="Homepage" variant="outlined" clickable />
          </MuiLink>
        )}
      </Box>

      {/* Owner Info */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Owner
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body1">
            <MuiLink
              href={metadata.project.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {metadata.project.name}
            </MuiLink>{" "}
            ({metadata.project.state})
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
        <MuiLink
          href={metadata.url}
          target="_blank"
          rel="noopener noreferrer"
          variant="button"
          sx={{
            px: 3,
            py: 1.5,
            borderRadius: 2,
            textDecoration: "none",
            backgroundColor: "primary.main",
            color: "white",
            "&:hover": { backgroundColor: "primary.dark" },
          }}
        >
          View Repository on Azure DevOps
        </MuiLink>
      </Box>

      <Accordion sx={{ mt: 3, boxShadow: 1, borderRadius: 2 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="raw-metadata-content"
          id="raw-metadata-header"
        >
          <Typography variant="h5">Raw JSON Metadata</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <CodeMirror
            value={JSON.stringify(metadata, null, 2)}
            extensions={[json()]}
            readOnly={true}
            style={{
              border: "1px solid silver",
              borderRadius: "8px",
              overflow: "hidden",
            }}
            height="400px"
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
