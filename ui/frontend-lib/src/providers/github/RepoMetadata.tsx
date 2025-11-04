import { useState, useEffect } from "react";

import { json } from "@codemirror/lang-json";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Link as MuiLink,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Chip,
  Grid,
  Typography,
} from "@mui/material";
import CodeMirror from "@uiw/react-codemirror";
import { format, formatDistanceToNow, parseISO } from "date-fns";

import { useConfig } from "../../common";
import GradientCircularProgress from "../../common/GradientCircularProgress";
import { notifyError } from "../../common/hooks/useNotification";

import { GithubRepo } from "./types";

interface GithubRepoMetadataProps {
  organization: string;
  name: string;
  queryParams?: Record<string, string>;
}

export function GithubRepoMetadata(props: GithubRepoMetadataProps) {
  const { organization, name, queryParams } = props;

  const { ikApi } = useConfig();
  const [metadata, setMetadata] = useState<GithubRepo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const link = `provider/github/repos/${organization}/${name}`;

  useEffect(() => {
    setLoading(true);
    setError(null); // Clear previous errors
    ikApi
      .get(link, queryParams)
      .then((response: GithubRepo) => {
        // Cast response to GithubRepo
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

  // Helper to format date strings
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      // Use parseISO for ISO 8601 strings, then formatDistanceToNow for relative time
      const date = parseISO(dateString);
      return `${format(date, "MMM dd,yyyy")} (${formatDistanceToNow(date, { addSuffix: true })})`;
    } catch (_) {
      return dateString; // Fallback to raw string if parsing fails
    }
  };

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
        {metadata.full_name}
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
        {metadata.language && (
          <Chip label={`Language: ${metadata.language}`} variant="outlined" />
        )}
        <Chip
          label={`Private: ${metadata.private ? "Yes" : "No"}`}
          variant="outlined"
        />
        {metadata.fork && <Chip label="Fork" variant="outlined" />}
        {metadata.archived && (
          <Chip label="Archived" variant="outlined" color="info" />
        )}
        {metadata.license && (
          <Chip
            label={`License: ${metadata.license.name}`}
            variant="outlined"
          />
        )}
        {metadata.homepage && (
          <MuiLink
            href={metadata.homepage}
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
        <Typography variant="h5" component="h2" gutterBottom>
          Owner
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Avatar alt={metadata.owner.login} src={metadata.owner.avatar_url} />
          <Typography variant="body1">
            <MuiLink
              href={metadata.owner.html_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {metadata.owner.login}
            </MuiLink>{" "}
            ({metadata.owner.type})
          </Typography>
        </Box>
      </Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid
          size={{
            xs: 12,
            sm: 6,
          }}
        >
          <Typography variant="h5" component="h2" gutterBottom>
            Statistics
          </Typography>
          <Typography variant="body2">
            <strong>Stars:</strong> {metadata.stargazers_count}
          </Typography>
          <Typography variant="body2">
            <strong>Watchers:</strong> {metadata.watchers_count}
          </Typography>
          <Typography variant="body2">
            <strong>Forks:</strong> {metadata.forks_count}
          </Typography>
          <Typography variant="body2">
            <strong>Open Issues:</strong> {metadata.open_issues_count}
          </Typography>
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 6,
          }}
        >
          <Typography variant="h5" component="h2" gutterBottom>
            Dates
          </Typography>
          <Typography variant="body2">
            <strong>Created:</strong> {formatDate(metadata.created_at)}
          </Typography>
          <Typography variant="body2">
            <strong>Last Updated:</strong> {formatDate(metadata.updated_at)}
          </Typography>
          <Typography variant="body2">
            <strong>Last Pushed:</strong> {formatDate(metadata.pushed_at)}
          </Typography>
        </Grid>
      </Grid>
      {metadata.topics && metadata.topics.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" component="h2" gutterBottom>
            Topics
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {metadata.topics.map((topic) => (
              <Chip key={topic} label={topic} size="small" />
            ))}
          </Box>
        </Box>
      )}
      <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
        <MuiLink
          href={metadata.html_url}
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
          View Repository on GitHub
        </MuiLink>
      </Box>
      <Accordion sx={{ mt: 3, boxShadow: 1, borderRadius: 2 }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="raw-metadata-content"
          id="raw-metadata-header"
        >
          <Typography variant="h5" component="h2">
            Raw JSON Metadata
          </Typography>
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
