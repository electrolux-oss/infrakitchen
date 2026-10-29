import { Link as RouterLink } from "react-router";

import { FilterClause } from "../common/components/filter_panel/FilterConfig";
import { Label } from "../common/components/labels";
import { DriftProjectReport, DriftSummary } from "../dashboard/types";
import { HeroExclamationTriangleIcon } from "../icons";
import { Divider, Link } from "../ui";
import { DRIFT_STATUS } from "../utils/constants";

export interface DriftWidgetProps {
  driftReport: DriftSummary | null;
}

function buildDriftedResourcesUrl(project: DriftProjectReport) {
  const filters: FilterClause[] = [
    project.projectId
      ? {
          id: `drift-project-${project.projectId}`,
          field: "project_id",
          operator: "eq",
          value: project.projectId,
        }
      : {
          id: "drift-project-unassigned",
          field: "project_id",
          operator: "is_none",
          value: true,
        },
    {
      id: `drift-status-${project.projectId ?? "all"}`,
      field: "drift__status",
      operator: "eq",
      value: DRIFT_STATUS.DRIFTED,
    },
  ];
  return `/resources?filter=${encodeURIComponent(JSON.stringify(filters))}`;
}

/**
 * Projects with resources that drifted from their state. Hidden until a drift
 * check has run, so it never shows while drift detection is off.
 */
export const DriftWidget = ({ driftReport }: DriftWidgetProps) => {
  const checked = (driftReport?.projects ?? []).reduce(
    (total, project) => total + project.inSync + project.drifted,
    0,
  );
  if (!driftReport || checked === 0) return null;

  const drifted = driftReport.projects.filter((project) => project.drifted > 0);
  const totalDrifted = drifted.reduce(
    (total, project) => total + project.drifted,
    0,
  );

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <HeroExclamationTriangleIcon className="text-[20px] text-primary" />
        <h6 className="m-0 text-subtitle1 font-semibold text-grey-500">
          Drift
        </h6>
        <Label
          className="ml-auto"
          tone={totalDrifted === 0 ? "success" : "warning"}
          label={
            totalDrifted === 0
              ? "All in sync"
              : `${totalDrifted} drifted of ${checked} checked`
          }
        />
      </div>
      <Divider className="mb-3" />
      <div className="rounded-surface border border-divider bg-paper p-4">
        {drifted.length === 0 ? (
          <p className="m-0 text-body2 text-fg-muted">
            Every checked resource matches its state.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {drifted.map((project) => (
              <li
                key={project.projectId ?? "__unassigned"}
                className="flex items-center gap-2"
              >
                <Link
                  component={RouterLink}
                  to={buildDriftedResourcesUrl(project)}
                  variant="body2"
                >
                  {project.projectName}
                </Link>
                <Label
                  className="ml-auto"
                  size="small"
                  tone="warning"
                  label={`${project.drifted} drifted`}
                />
                <span className="text-caption text-fg-muted">
                  {project.score}% in sync
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
