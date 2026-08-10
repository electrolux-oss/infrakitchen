import { MouseEvent, useState } from "react";

import { useNavigate } from "react-router";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import SecurityIcon from "@mui/icons-material/Security";
import UpdateIcon from "@mui/icons-material/Update";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  alpha,
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  IconButton,
  Link,
  Tooltip,
  Typography,
} from "@mui/material";

import { FilterClause } from "../common/components/filter_panel/FilterConfig";
import {
  GoldenStateProjectReport,
  GoldenStateSummary,
} from "../dashboard/types";
import { VERSION_LIFECYCLE_STATE } from "../utils/constants";

export interface GoldenStateWidgetProps {
  goldenStateReport: GoldenStateSummary | null;
  loading?: boolean;
  expandable?: boolean;
}

export function getScoreChipColor(
  score: number,
): "success" | "warning" | "error" | "info" {
  if (score >= 90) return "success";
  if (score >= 70) return "warning";
  return "error";
}

function buildProjectResourcesUrl(
  project: GoldenStateProjectReport,
  extraClauses: FilterClause[] = [],
) {
  const filters: FilterClause[] = [
    project.projectId
      ? {
          id: `gsp-project-${project.projectId}`,
          field: "project_id",
          operator: "eq",
          value: project.projectId,
        }
      : {
          id: "gsp-project-unassigned",
          field: "project_id",
          operator: "is_none",
          value: true,
        },
    ...extraClauses,
  ];

  return `/resources?filter=${encodeURIComponent(JSON.stringify(filters))}`;
}

function buildProjectPageResourcesUrl(project: GoldenStateProjectReport) {
  if (!project.projectId) {
    return buildProjectResourcesUrl(project);
  }

  return `/projects/${project.projectId}/resources`;
}

function isPlainLeftClick(event: MouseEvent<HTMLElement>) {
  return !(
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  );
}

function ProjectHeatMapTile({
  project,
}: {
  project: GoldenStateProjectReport;
}) {
  const navigate = useNavigate();
  const comparable = project.total - project.noGolden;
  const scoreColor = getScoreChipColor(project.score);
  const resourcesUrl = buildProjectResourcesUrl(project);
  const projectPageResourcesUrl = buildProjectPageResourcesUrl(project);
  const activeResourcesUrl = buildProjectResourcesUrl(project, [
    {
      id: `gsp-active-${project.projectId ?? "all"}`,
      field: "source_code_version__lifecycle_state",
      operator: "eq",
      value: VERSION_LIFECYCLE_STATE.ACTIVE,
    },
  ]);
  const previewResourcesUrl = buildProjectResourcesUrl(project, [
    {
      id: `gsp-preview-${project.projectId ?? "all"}`,
      field: "source_code_version__lifecycle_state",
      operator: "eq",
      value: VERSION_LIFECYCLE_STATE.PREVIEW,
    },
  ]);
  const deprecatedResourcesUrl = buildProjectResourcesUrl(project, [
    {
      id: `gsp-deprecated-${project.projectId ?? "all"}`,
      field: "source_code_version__lifecycle_state",
      operator: "eq",
      value: VERSION_LIFECYCLE_STATE.DEPRECATED,
    },
  ]);
  const archivedResourcesUrl = buildProjectResourcesUrl(project, [
    {
      id: `gsp-archived-${project.projectId ?? "all"}`,
      field: "source_code_version__lifecycle_state",
      operator: "eq",
      value: VERSION_LIFECYCLE_STATE.ARCHIVED,
    },
  ]);

  const handleNavigate = (url: string) => (event: MouseEvent<HTMLElement>) => {
    if (!isPlainLeftClick(event)) {
      return;
    }

    event.preventDefault();
    void navigate(url);
  };

  return (
    <Box
      component="a"
      href={projectPageResourcesUrl}
      onClick={handleNavigate(projectPageResourcesUrl)}
      sx={(theme) => ({
        display: "flex",
        flexDirection: "column",
        gap: 1,
        minHeight: 128,
        p: 1.5,
        borderRadius: 1.5,
        color: "text.primary",
        textDecoration: "none",
        backgroundColor: alpha(theme.palette[scoreColor].main, 0.16),
        border: `1px solid ${alpha(theme.palette[scoreColor].main, 0.4)}`,
        transition: "transform 120ms ease, box-shadow 120ms ease",
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: theme.shadows[2],
        },
      })}
    >
      <Link
        component="a"
        href={resourcesUrl}
        onClick={handleNavigate(resourcesUrl)}
        underline="hover"
        variant="body2"
        sx={{
          fontWeight: 600,
          color: "inherit",
          lineHeight: 1.3,
        }}
      >
        {project.projectName}
      </Link>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Chip
          label={`${project.score}%`}
          size="small"
          color={scoreColor}
          variant="filled"
        />
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
          }}
        >
          {project.compliant}/{comparable} at golden state
        </Typography>
      </Box>
      <Box
        sx={{
          mt: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 0.75,
        }}
      >
        {project.compliant > 0 && (
          <Chip
            component="a"
            clickable
            href={activeResourcesUrl}
            onClick={handleNavigate(activeResourcesUrl)}
            icon={<CheckCircleIcon />}
            label={project.compliant}
            size="small"
            color="success"
            variant="outlined"
            sx={{ justifyContent: "flex-start" }}
          />
        )}
        {project.updateAvailable > 0 && (
          <Chip
            component="a"
            clickable
            href={previewResourcesUrl}
            onClick={handleNavigate(previewResourcesUrl)}
            icon={<UpdateIcon />}
            label={project.updateAvailable}
            size="small"
            color="info"
            variant="outlined"
            sx={{ justifyContent: "flex-start" }}
          />
        )}
        {project.deprecated > 0 && (
          <Chip
            component="a"
            clickable
            href={deprecatedResourcesUrl}
            onClick={handleNavigate(deprecatedResourcesUrl)}
            icon={<WarningAmberIcon />}
            label={project.deprecated}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ justifyContent: "flex-start" }}
          />
        )}
        {project.critical > 0 && (
          <Chip
            component="a"
            clickable
            href={archivedResourcesUrl}
            onClick={handleNavigate(archivedResourcesUrl)}
            icon={<ErrorOutlineIcon />}
            label={project.critical}
            size="small"
            color="error"
            variant="outlined"
            sx={{ justifyContent: "flex-start" }}
          />
        )}
        {project.noGolden > 0 && (
          <Chip
            label={`${project.noGolden} no golden`}
            size="small"
            variant="outlined"
            sx={{ gridColumn: "1 / -1", justifyContent: "flex-start" }}
          />
        )}
      </Box>
    </Box>
  );
}

export const GoldenStateWidget = ({
  goldenStateReport,
  loading = false,
  expandable = false,
}: GoldenStateWidgetProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!goldenStateReport && !loading) return null;

  return (
    <Card sx={{ width: "100%" }}>
      <CardHeader
        avatar={<SecurityIcon sx={{ color: "primary.main" }} />}
        title="Golden State Compliance"
        subheader={
          goldenStateReport
            ? `Overall score: ${goldenStateReport.overallScore}%`
            : "Loading..."
        }
        action={
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1, mr: 1, mt: 1 }}
          >
            {goldenStateReport ? (
              <Chip
                label={`${goldenStateReport.overallScore}%`}
                color={getScoreChipColor(goldenStateReport.overallScore)}
                size="small"
                sx={{ fontWeight: 700 }}
              />
            ) : null}
            {expandable ? (
              <Tooltip title={expanded ? "Collapse" : "Expand"}>
                <IconButton
                  size="small"
                  onClick={() => setExpanded((current) => !current)}
                  aria-label={
                    expanded
                      ? "Collapse golden state widget"
                      : "Expand golden state widget"
                  }
                >
                  {expanded ? (
                    <CloseFullscreenIcon fontSize="small" />
                  ) : (
                    <OpenInFullIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            ) : null}
          </Box>
        }
      />
      <CardContent
        sx={{
          maxHeight: expanded ? "none" : 400,
          height: expanded ? "100%" : "auto",
          overflowY: expanded ? "visible" : "auto",
        }}
      >
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              py: 2,
            }}
          >
            <CircularProgress size={24} />
          </Box>
        ) : goldenStateReport && goldenStateReport.projects.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 3,
              color: "text.secondary",
            }}
          >
            <SecurityIcon sx={{ fontSize: 36, mb: 1, opacity: 0.5 }} />
            <Typography
              variant="body2"
              sx={{
                textAlign: "center",
              }}
            >
              No resources to evaluate.
            </Typography>
            <Typography
              variant="caption"
              sx={{
                textAlign: "center",
              }}
            >
              Create resources with templates that have an Active version to see
              compliance.
            </Typography>
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
              <Chip
                label="90-100%"
                size="small"
                color="success"
                variant="outlined"
              />
              <Chip
                label="70-89%"
                size="small"
                color="warning"
                variant="outlined"
              />
              <Chip
                label="0-69%"
                size="small"
                color="error"
                variant="outlined"
              />
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  lg: "repeat(3, minmax(0, 1fr))",
                },
                gap: 1.5,
              }}
            >
              {goldenStateReport?.projects.map((project) => (
                <ProjectHeatMapTile
                  key={project.projectId ?? "__unassigned"}
                  project={project}
                />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
