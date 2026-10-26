import { useState } from "react";

import { Entity } from "../../common/components/entities/Entity";
import { EntityReference } from "../../common/components/fields/CommonField";
import { Duration } from "../../common/components/fields/Duration";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { CountLabel, Label, StatusLabel } from "../../common/components/labels";
import { LogActionButtons } from "../../common/LogsComponent/LogActionButtons";
import { LogsDialog } from "../../common/LogsComponent/LogsDialog";
import { HeroChevronDownIcon } from "../../icons";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  StepNumber,
} from "../../ui";
import { cn } from "../../utils/cn";
import { GqlWorkflowAction, GqlWorkflowStep } from "../graphql";

interface WorkflowStepProps {
  step: GqlWorkflowStep;
  workflowAction?: GqlWorkflowAction;
  workflowId?: string;
}

export const WorkflowStep = ({
  step,
  workflowAction,
  workflowId,
}: WorkflowStepProps) => {
  const [logView, setLogView] = useState<"summary" | "logs" | null>(null);
  const [expandedVars, setExpandedVars] = useState<string | null>(null);

  const templateName = step.template?.name;
  const hasVars = Object.keys(step.resolvedVariables || {}).length > 0;
  const externalInputs = step.parentResourceIds;

  return (
    <div className="w-full">
      <div
        className={cn(
          "border",
          step.status === "error"
            ? "border-error"
            : step.status === "done"
              ? "border-success"
              : "border-divider",
          "mb-4 overflow-hidden rounded-surface",
        )}
        key={step.id}
      >
        {/* Step header */}
        <div className="flex items-center justify-between border-b border-divider bg-canvas px-4 py-3">
          <div className="flex items-center gap-4">
            <StepNumber step={step.position + 1} />
            {templateName ? (
              <Entity entity={step.template} />
            ) : (
              <h6 className="m-0 font-mono text-subtitle2 text-grey-500">
                {step.template?.id.slice(0, 8)}…
              </h6>
            )}
            <StatusLabel status={step.status} />
          </div>
          <div className="flex items-center gap-4">
            {step.startedAt && (
              <span className="text-caption text-fg-muted">
                <RelativeTime date={step.startedAt} />
              </span>
            )}
            {workflowId && step.resource?.id && (
              <LogActionButtons
                action="any"
                sourceCodeLanguage="opentofu"
                onOpenSummary={() => setLogView("summary")}
                onOpenLogs={() => setLogView("logs")}
              />
            )}
          </div>
        </div>

        {step.status === "in_progress" && <LinearProgress />}

        {logView && workflowId && step.resource?.id && (
          <LogsDialog
            entityId={step.resource.id}
            traceId={workflowId}
            view={logView}
            action="any"
            onViewChange={setLogView}
            onClose={() => setLogView(null)}
          />
        )}

        {/* Step detail fields */}
        <div className="px-4 py-3">
          <div className="grid grid-cols-[1fr] gap-4 sm:grid-cols-[1fr_1fr_1fr]">
            {/* Resource */}
            <div>
              <span className="text-caption text-fg-muted">Resource</span>
              <div className="mt-1">
                {step.resource?.id != null ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <EntityReference
                      id={step.resource.id}
                      entityName="resource"
                      identifier={
                        step.resource?.name ??
                        step.resource.id.slice(0, 8) + "…"
                      }
                    />
                    {step.resource.status && (
                      <StatusLabel
                        status={step.resource.status}
                        state={step.resource.state}
                      />
                    )}
                  </div>
                ) : (
                  <p className="m-0 text-body2 text-fg-disabled">
                    {workflowAction === "destroy"
                      ? "Resource removed"
                      : "Not created yet"}
                  </p>
                )}
              </div>
            </div>

            {/* SCV */}
            {step.sourceCodeVersion?.id && (
              <div>
                <span className="text-caption text-fg-muted">
                  Source Code Version
                </span>
                <div className="mt-1">
                  <Entity
                    entity={{
                      ...step.sourceCodeVersion,
                      entityType: "source_code_version",
                      identifier:
                        step.sourceCodeVersion.identifier ??
                        step.sourceCodeVersion.id.slice(0, 8) + "…",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Duration */}
            {step.startedAt && step.completedAt && (
              <div>
                <span className="text-caption text-fg-muted">Duration</span>
                <div className="mt-1">
                  <Duration start={step.startedAt} end={step.completedAt} />
                </div>
              </div>
            )}

            {/* Parents */}
            {step.parentResourceIds && step.parentResourceIds.length > 0 && (
              <div className="mt-3">
                <span className="text-caption font-semibold text-fg-muted">
                  Parent Resources
                </span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {step.parentResourceIds.map((res) => (
                    <EntityReference
                      key={res.id}
                      id={res.id}
                      entityName="resource"
                      identifier={res.name ?? res.id.slice(0, 8) + "…"}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* External inputs from workflow wiring (read-only) */}
            {externalInputs && externalInputs.length > 0 && (
              <div className="mt-3">
                <span className="text-caption font-semibold text-fg-muted">
                  External Inputs (Read-only)
                </span>
                <div className="mt-1 flex flex-col gap-1.5">
                  {externalInputs.map((resource) => (
                    <div
                      className="flex items-center justify-between gap-2 rounded-surface border border-divider bg-paper px-2 py-1.5"
                      key={`external-${resource.id}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-caption text-fg-muted">
                          {resource.template?.name ??
                            resource.template?.id ??
                            "External"}
                        </span>
                        {resource.template?.abstract && (
                          <Label tone="info" label="ABSTRACT" />
                        )}
                      </div>
                      <EntityReference
                        id={resource.id}
                        entityName="resource"
                        identifier={
                          resource.name ?? resource.id.slice(0, 8) + "…"
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* integrations */}
            {step.integrationIds && step.integrationIds.length > 0 && (
              <div>
                <span className="text-caption text-fg-muted">Integrations</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {step.integrationIds.map((integration) => (
                    <Label
                      key={integration.id}
                      label={<Entity entity={integration} />}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {step.errorMessage && (
            <div className="mt-3 rounded-surface bg-error p-3 font-mono text-[13px] [word-break:break-word] whitespace-pre-wrap text-error-contrast">
              {step.errorMessage}
            </div>
          )}
          {/* Resolved variables (collapsible) */}
          {hasVars && (
            <Accordion
              standalone
              className="mt-3"
              expanded={expandedVars === step.id}
              onChange={() =>
                setExpandedVars((prev) => (prev === step.id ? null : step.id))
              }
            >
              <AccordionSummary expandIcon={<HeroChevronDownIcon />}>
                <div className="text-caption font-semibold">
                  <CountLabel
                    label="Resolved Variables"
                    count={Object.keys(step.resolvedVariables || {}).length}
                  />
                </div>
              </AccordionSummary>
              <AccordionDetails className="p-0">
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Variable</TableCell>
                        <TableCell>Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(step.resolvedVariables || {}).map(
                        ([key, value]) => (
                          <TableRow key={key}>
                            <TableCell>
                              <p className="m-0 font-mono text-[12px] font-normal">
                                {key}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="m-0 max-w-100 font-mono text-[12px] font-normal break-all">
                                {typeof value === "object"
                                  ? JSON.stringify(value)
                                  : String(value)}
                              </p>
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
};
