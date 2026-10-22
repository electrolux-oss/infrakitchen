import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import {
  CommonField,
  EntityReference,
} from "../../common/components/fields/CommonField";
import { Duration } from "../../common/components/fields/Duration";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { Label } from "../../common/components/labels";
import { StatusLabel } from "../../common/components/labels";
import { GqlWorkflow } from "../graphql";

export interface WorkflowSidebarProps {
  workflow: GqlWorkflow;
}

/**
 * Right context sidebar for the workflow detail page: groups the
 * workflow's status, timing, templates and history so the main column can
 * focus on its steps, variables and logs.
 */
export const WorkflowSidebar = ({ workflow }: WorkflowSidebarProps) => {
  // Derive unique templates from steps
  const templates = workflow.steps
    .map((s) => s.template)
    .filter(
      (t, i, arr): t is NonNullable<typeof t> =>
        t !== null && arr.findIndex((x) => x?.id === t.id) === i,
    );

  return (
    <EntitySidebar ariaLabel="Workflow details">
      <SidebarSection title="Status">
        <div className="col-span-full">
          <div className="flex items-center gap-2">
            <StatusLabel status={workflow.status} />
            <Label label={workflow.action.toUpperCase()} />
          </div>
        </div>
        {workflow.errorMessage && (
          <CommonField
            name="Error"
            value={
              <Label size="small" tone="error" label={workflow.errorMessage} />
            }
            span="full"
          />
        )}
      </SidebarSection>

      {(workflow.startedAt || workflow.completedAt) && (
        <SidebarSection title="Timing">
          {workflow.startedAt && (
            <CommonField
              name="Started"
              value={<RelativeTime date={workflow.startedAt} />}
              span="half"
            />
          )}
          {workflow.completedAt && (
            <CommonField
              name="Completed"
              value={<RelativeTime date={workflow.completedAt} />}
              span="half"
            />
          )}
          {workflow.startedAt && workflow.completedAt && (
            <CommonField
              name="Duration"
              value={
                <Duration
                  start={workflow.startedAt}
                  end={workflow.completedAt}
                />
              }
              span="full"
            />
          )}
        </SidebarSection>
      )}

      {templates.length > 0 && (
        <SidebarSection title="Templates" count={templates.length}>
          <div className="col-span-full">
            <div className="flex flex-wrap gap-2">
              {templates.map((t) => (
                <EntityReference
                  key={t.id}
                  id={t.id}
                  entityName="template"
                  name={t.name}
                />
              ))}
            </div>
          </div>
        </SidebarSection>
      )}

      <SidebarDetailsSection
        entity={{ creator: workflow.creator, createdAt: workflow.createdAt }}
      />
    </EntitySidebar>
  );
};
