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
    project.drifted > 0
      ? {
          id: `drift-status-${project.projectId ?? "all"}`,
          field: "drift__status",
          operator: "eq",
          value: DRIFT_STATUS.DRIFTED,
        }
      : {
          // listed for their failing checks, which the Drift column marks
          id: `drift-status-${project.projectId ?? "all"}`,
          field: "drift__status",
          operator: "in",
          value: [
            DRIFT_STATUS.IN_SYNC,
            DRIFT_STATUS.DRIFTED,
            DRIFT_STATUS.ERROR,
            DRIFT_STATUS.UNKNOWN,
          ],
        },
  ];
  return `/resources?filter=${encodeURIComponent(JSON.stringify(filters))}`;
}

/**
 * Projects with resources that drifted from their state or whose drift checks
 * fail. Hidden until a drift check has run, so it never shows while drift
 * detection is off.
 */
export const DriftWidget = ({ driftReport }: DriftWidgetProps) => {
  if (!driftReport) return null;
  // resources whose checks never succeeded count as checked, but are shown apart from drift
  const checked = driftReport.inSync + driftReport.drifted + driftReport.error;
  if (checked === 0) return null;

  const affected = driftReport.projects.filter(
    (project) => project.drifted > 0 || project.failing > 0,
  );
  const allInSync = driftReport.drifted === 0 && driftReport.failing === 0;
  const headline = allInSync
    ? `All ${checked} checked in sync`
    : [
        driftReport.drifted > 0 ? `${driftReport.drifted} drifted` : null,
        driftReport.failing > 0
          ? `${driftReport.failing} ${driftReport.failing === 1 ? "check" : "checks"} failing`
          : null,
      ]
        .filter(Boolean)
        .join(", ") + ` of ${checked} checked`;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <HeroExclamationTriangleIcon className="text-[20px] text-primary" />
        <h6 className="m-0 text-subtitle1 font-semibold text-grey-500">
          Drift
        </h6>
        <Label
          className="ml-auto"
          tone={allInSync ? "success" : "warning"}
          label={headline}
        />
      </div>
      <Divider className="mb-3" />
      <div className="rounded-surface border border-divider bg-paper p-4">
        {affected.length === 0 ? (
          <p className="m-0 text-body2 text-fg-muted">
            Every checked resource matches its state.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {affected.map((project) => (
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
                {project.drifted > 0 && (
                  <Label
                    className="ml-auto"
                    size="small"
                    tone="warning"
                    label={`${project.drifted} drifted`}
                  />
                )}
                {project.failing > 0 && (
                  <Label
                    className={project.drifted > 0 ? undefined : "ml-auto"}
                    size="small"
                    tone="error"
                    label={`${project.failing} ${project.failing === 1 ? "check" : "checks"} failing`}
                  />
                )}
                <span className="text-caption text-fg-muted">
                  of {project.inSync + project.drifted + project.error} checked
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
