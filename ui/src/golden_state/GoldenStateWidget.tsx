import { useState, type MouseEvent } from "react";

import { Link as RouterLink } from "react-router";

import { FilterClause } from "../common/components/filter_panel/FilterConfig";
import { Label } from "../common/components/labels";
import {
  GoldenStateProjectReport,
  GoldenStateSummary,
} from "../dashboard/types";
import {
  HeroArrowPathIcon,
  HeroArrowsPointingInIcon,
  HeroArrowsPointingOutIcon,
  HeroCheckCircleIcon,
  HeroExclamationCircleIcon,
  HeroExclamationTriangleIcon,
  HeroShieldCheckIcon,
} from "../icons";
import { Divider, Spinner, IconButton, Tooltip, Link } from "../ui";
import { cn } from "../utils/cn";
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

// Tinted card surface per score color (static so Tailwind can see it).
const SCORE_CARD_CLASSES: Record<
  ReturnType<typeof getScoreChipColor>,
  string
> = {
  success: "bg-success/16 border-success/40",
  warning: "bg-warning/16 border-warning/40",
  error: "bg-error/16 border-error/40",
  info: "bg-info/16 border-info/40",
};

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

function ProjectHeatMapTile({
  project,
}: {
  project: GoldenStateProjectReport;
}) {
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

  return (
    <RouterLink
      to={projectPageResourcesUrl}
      className={cn(
        "flex min-h-32 flex-col gap-2 rounded-[12px] border p-3 text-fg no-underline [transition:transform_120ms_ease,box-shadow_120ms_ease] hover:[transform:translateY(-1px)] hover:shadow-[var(--ik-shadow-2)]",
        SCORE_CARD_CLASSES[scoreColor],
      )}
    >
      <Link
        className="leading-[1.3] font-semibold"
        component={RouterLink}
        to={resourcesUrl}
        variant="body2"
        color="inherit"
      >
        {project.projectName}
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <Label tone={scoreColor} label={`${project.score}%`} />
        <span className="text-caption text-fg-muted">
          {project.compliant}/{comparable} at golden state
        </span>
      </div>

      <div className="mt-auto grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-1.5">
        {project.compliant > 0 && (
          <Label
            size="small"
            tone="success"
            icon={<HeroCheckCircleIcon />}
            label={project.compliant}
            component={RouterLink}
            to={activeResourcesUrl}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            className="justify-self-start"
          />
        )}
        {project.updateAvailable > 0 && (
          <Label
            size="small"
            tone="info"
            icon={<HeroArrowPathIcon />}
            label={project.updateAvailable}
            component={RouterLink}
            to={previewResourcesUrl}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            className="justify-self-start"
          />
        )}
        {project.deprecated > 0 && (
          <Label
            size="small"
            tone="warning"
            icon={<HeroExclamationTriangleIcon />}
            label={project.deprecated}
            component={RouterLink}
            to={deprecatedResourcesUrl}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            className="justify-self-start"
          />
        )}
        {project.critical > 0 && (
          <Label
            size="small"
            tone="error"
            icon={<HeroExclamationCircleIcon />}
            label={project.critical}
            component={RouterLink}
            to={archivedResourcesUrl}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            className="justify-self-start"
          />
        )}
        {project.noGolden > 0 && (
          <Label
            className="col-[1_/_-1] justify-self-start"
            label={`${project.noGolden} no golden`}
          />
        )}
      </div>
    </RouterLink>
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
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <HeroShieldCheckIcon className="text-[20px] text-primary" />
        <h6 className="m-0 text-subtitle1 font-semibold text-grey-500">
          Golden State Compliance
        </h6>
        {goldenStateReport ? (
          <Label
            className="ml-auto"
            tone={getScoreChipColor(goldenStateReport.overallScore)}
            label={`${goldenStateReport.overallScore}%`}
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
                <HeroArrowsPointingInIcon fontSize="small" />
              ) : (
                <HeroArrowsPointingOutIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        ) : null}
      </div>
      <Divider className="mb-3" />
      <div
        className={cn(
          expanded ? "max-h-none" : "max-h-100",
          expanded ? "overflow-y-visible" : "overflow-y-auto",
          "rounded-surface border border-divider bg-paper p-4",
        )}
      >
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size={24} />
          </div>
        ) : goldenStateReport && goldenStateReport.projects.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-fg-muted">
            <HeroShieldCheckIcon className="mb-2 text-[36px] opacity-50" />
            <p className="m-0 text-center text-body2">
              No resources to evaluate.
            </p>
            <span className="text-center text-caption">
              Create resources with templates that have an Active version to see
              compliance.
            </span>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Label tone="success" label="90-100%" />
              <Label tone="warning" label="70-89%" />
              <Label tone="error" label="0-69%" />
            </div>
            <div className="grid grid-cols-[1fr] gap-3 sm:grid-cols-[repeat(2,_minmax(0,_1fr))] lg:grid-cols-[repeat(3,_minmax(0,_1fr))]">
              {goldenStateReport?.projects.map((project) => (
                <ProjectHeatMapTile
                  key={project.projectId ?? "__unassigned"}
                  project={project}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
