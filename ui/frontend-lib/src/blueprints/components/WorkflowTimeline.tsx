import { useNavigate } from "react-router";

import { useConfig } from "../../common";
import { Entity } from "../../common/components/entities/Entity";
import StatusChip from "../../common/StatusChip";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Link,
} from "../../ui";
import { GqlWorkflow } from "../../workflows/graphql";

interface WorkflowTimelineProps {
  workflows: GqlWorkflow[];
}

export const WorkflowTimeline = ({ workflows }: WorkflowTimelineProps) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  if (workflows.length === 0) {
    return (
      <p className="m-0 py-4 text-body2 text-fg-muted">No workflows yet.</p>
    );
  }

  return (
    <div className="w-full">
      {workflows.map((exec) => (
        <div
          className="mb-6 overflow-hidden rounded-surface border border-divider"
          key={exec.id}
        >
          <div className="flex items-center justify-between border-b border-divider bg-canvas px-4 py-3">
            <div className="flex items-center gap-4">
              <h6 className="m-0 font-mono text-subtitle2 text-grey-500">
                <Link
                  className="cursor-pointer font-mono"
                  component="button"
                  variant="subtitle2"
                  onClick={() => navigate(`${linkPrefix}workflows/${exec.id}`)}
                >
                  {exec.id.slice(0, 8)}…
                </Link>
              </h6>
              <StatusChip status={exec.status} />
            </div>
            <span className="text-caption text-fg-muted">
              {new Date(exec.createdAt).toLocaleString()}
            </span>
          </div>

          {exec.status === "in_progress" && <LinearProgress />}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={50}>#</TableCell>
                  <TableCell>Template</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exec.steps.map((step) => (
                  <TableRow key={step.id}>
                    <TableCell>{step.position + 1}</TableCell>
                    <TableCell>
                      <Entity
                        entity={{
                          id: step.template?.id,
                          entityType: "template",
                          name: step.template?.name || "Template",
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={step.status} />
                    </TableCell>
                    <TableCell>
                      {step.resource ? (
                        <Entity
                          entity={{
                            id: step.resource?.id,
                            entityType: "resource",
                            name: step.resource?.name || "Resource",
                          }}
                        />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {step.errorMessage ? (
                        <span className="block max-w-50 truncate text-caption text-error">
                          {step.errorMessage}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      ))}
    </div>
  );
};
