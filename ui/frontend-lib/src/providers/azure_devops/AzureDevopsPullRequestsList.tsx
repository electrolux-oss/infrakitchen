import { useState, useEffect } from "react";

import { json } from "@codemirror/lang-json";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Alert,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Link as MuiLink,
} from "@mui/material";
import CodeMirror from "@uiw/react-codemirror";
import { formatDistanceToNow, parseISO } from "date-fns";

import { useConfig } from "../../common";
import GradientCircularProgress from "../../common/GradientCircularProgress";
import { notifyError } from "../../common/hooks/useNotification";

import { AzureDevopsPullRequest } from "./types";

interface AzureDevopsPullRequestsListProps {
  organization: string;
  repoName: string;
  queryParams?: Record<string, string>;
}

export function AzureDevopsPullRequestsList(
  props: AzureDevopsPullRequestsListProps,
) {
  const { organization, repoName, queryParams } = props;

  const { ikApi } = useConfig();
  const [pullRequests, setPullRequests] = useState<
    AzureDevopsPullRequest[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const link = `provider/azure_devops/repos/${organization}/${repoName}/pulls`;

  useEffect(() => {
    setLoading(true);
    setError(null); // Reset error on new fetch
    ikApi
      .get(link, queryParams)
      .then((response: AzureDevopsPullRequest[]) => {
        setPullRequests(response);
      })
      .catch((err: { message: string }) => {
        notifyError(err);
        setError(new Error(err.message));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [ikApi, organization, repoName, link, queryParams]);

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

  if (!pullRequests || pullRequests.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          No pull requests found for {organization}/{repoName}.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", typography: "body1", p: 2 }}>
      <Typography variant="h5" gutterBottom>
        Pull Requests for {organization}/{repoName}
      </Typography>
      {pullRequests.map((pr) => (
        <Accordion
          key={pr.pullRequestId}
          sx={{ mb: 1, boxShadow: 1, borderRadius: 2 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls={`panel-${pr.pullRequestId}-content`}
            id={`panel-${pr.pullRequestId}-header`}
          >
            <Box
              sx={{ display: "flex", flexDirection: "column", width: "100%" }}
            >
              <Typography variant="body1" fontWeight="bold">
                #{pr.pullRequestId}: {pr.title}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", mt: 0.5 }}>
                <Chip
                  label={pr.status}
                  color={pr.status === "active" ? "success" : "error"}
                  size="small"
                  sx={{ mr: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Opened by{" "}
                  <MuiLink
                    href={pr.createdBy.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {pr.createdBy.displayName}
                  </MuiLink>{" "}
                  {formatDistanceToNow(parseISO(pr.creationDate), {
                    addSuffix: true,
                  })}
                </Typography>
              </Box>
              <Box mt={2} display="flex" justifyContent="flex-end">
                <MuiLink
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="button"
                >
                  View on Azure DevOps
                </MuiLink>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="h5" gutterBottom>
              Full PR Metadata:
            </Typography>
            <CodeMirror
              value={JSON.stringify(pr, null, 2)}
              extensions={[json()]}
              readOnly={true}
              style={{
                border: "1px solid silver",
                borderRadius: "8px",
                overflow: "hidden",
              }}
              height="300px"
            />
            {pr.description && pr.description.length > 0 && (
              <Box mt={2}>
                <Typography variant="h5" gutterBottom>
                  Description:
                </Typography>
                <Box
                  sx={{
                    border: "1px solid #ccc",
                    p: 2,
                    borderRadius: "8px",
                    backgroundColor: "#f9f9f9",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {pr.description}
                  </Typography>
                </Box>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
