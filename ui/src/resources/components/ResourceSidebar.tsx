import { useMemo, useState } from "react";

import { Entity, UserAvatarList } from "../../common";
import { DownloadSourceCodeButton } from "../../common/components/buttons/DownloadSourceCodeButton";
import { FavoriteButton } from "../../common/components/buttons/FavoriteButton";
import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableNameField } from "../../common/components/editors/EditableNameField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { EditAffordance } from "../../common/components/editors/EditAffordance";
import {
  CommonField,
  EntityReference,
} from "../../common/components/fields/CommonField";
import {
  PlaceholderDescription,
  PlaceholderText,
} from "../../common/components/fields/PlaceholderDescription";
import { ScheduledApplyValue } from "../../common/components/fields/ScheduledApplyValue";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { CountLabel, StatusLabel } from "../../common/components/labels";
import { Labels } from "../../common/components/labels/Labels";
import { useConfig } from "../../common/context";
import { usePendingScheduledAction } from "../../common/hooks/usePendingScheduledAction";
import { ToolSelect, toolLabel } from "../../tools";
import { IkEntity } from "../../types";
import { GqlResource } from "../graphql";
import { useResourceFieldEditor } from "../hooks/useResourceFieldEditor";
import { useResourceNotificationDialog } from "../hooks/useResourceNotificationDialog";

import { SubscribeNotificationButton } from "./notifications/SubscribeNotificationButton";
import { ResourceInfrastructureSection } from "./ResourceInfrastructureSection";

export interface ResourceSidebarProps {
  resource: GqlResource;
  /** Opens the variables / template version edit dialog. */
  onEditVariables: () => void;
  onSubscriptionChange?: () => void;
}

const sortByName = <T extends { name?: string | null }>(items: T[]) =>
  [...items].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

/** Scrollable list of related resources for the Parents/Children sections. */
const RelatedResources = ({
  resources,
}: {
  resources: GqlResource["parents"];
}) =>
  resources && resources.length > 0 ? (
    <div className="flex max-h-45 flex-col gap-1 overflow-y-auto">
      {sortByName(resources).map((related) => (
        <Entity key={related.id} entity={related} showLabel stacked />
      ))}
    </div>
  ) : null;

/**
 * Right context sidebar for the resource detail page: groups the context a
 * user scans for first — ownership, template, infrastructure bindings,
 * relations and history — so the main column can focus on the resource itself.
 */
export const ResourceSidebar = ({
  resource,
  onEditVariables,
  onSubscriptionChange,
}: ResourceSidebarProps) => {
  const { ikApi } = useConfig();
  const { canEdit, saveField, withPendingChange } =
    useResourceFieldEditor(resource);
  const { loading, isSubscribed, handleSubscribe, handleUnsubscribe } =
    useResourceNotificationDialog({
      resourceId: String(resource.id),
      onSubscriptionChange,
    });
  const { pendingScheduledAction } = usePendingScheduledAction();
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const projectId = resource.project?.id;
  const attachedProjectIds = useMemo(
    () => (projectId ? [String(projectId)] : []),
    [projectId],
  );

  const projectOwners = resource.project?.owners ?? [];
  const parents = resource.parents ?? [];
  const children = resource.children ?? [];

  return (
    <EntitySidebar ariaLabel="Resource details">
      <SidebarSection
        title="About"
        action={
          <div className="flex items-center">
            {/* Abstract resources have no source code to download. */}
            {resource.abstract === false && (
              <DownloadSourceCodeButton entityId={String(resource.id)} />
            )}
            <FavoriteButton
              componentId={String(resource.id)}
              componentType="resource"
              ariaLabel="Add resource to favorites"
              isFavorite={resource.isFavorite}
            />
            <SubscribeNotificationButton
              isSubscribed={isSubscribed}
              isLoading={loading}
              onSubscribeClick={(inheritChildren) =>
                void handleSubscribe(inheritChildren)
              }
              onUnsubscribeClick={(inheritChildren) =>
                void handleUnsubscribe(inheritChildren)
              }
            />
          </div>
        }
      >
        <EditableNameField
          value={resource.name}
          canEdit={canEdit}
          onSave={(value) => saveField({ name: value })}
          display={withPendingChange(<span>{resource.name}</span>, "name")}
        />
        <EditableDescriptionField
          value={resource.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
          display={withPendingChange(
            resource.description ? (
              <span>{resource.description}</span>
            ) : (
              <PlaceholderDescription />
            ),
            "description",
          )}
        />
        <CommonField
          name="Status"
          value={
            <StatusLabel status={resource.status} state={resource.state} />
          }
          span="full"
        />
        <EditableTagsField
          value={resource.labels ?? []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
          display={withPendingChange(
            <Labels labels={resource.labels || []} />,
            "labels",
          )}
        />
        {pendingScheduledAction && (
          <CommonField
            name="Next Scheduled Apply"
            value={
              <ScheduledApplyValue scheduledAction={pendingScheduledAction} />
            }
            span="full"
          />
        )}
      </SidebarSection>

      <SidebarSection title="Project">
        <CommonEditableField<string | null>
          name="Project"
          canEdit={canEdit}
          value={resource.project?.id ?? null}
          ariaLabel="Edit project"
          display={withPendingChange(
            resource.project ? <EntityReference {...resource.project} /> : null,
            "project_id",
          )}
          onSave={(value) => saveField({ projectId: value })}
          renderEditor={({ value, onChange }) => (
            <ReferenceInput
              ikApi={ikApi}
              buffer={buffer}
              setBuffer={setBuffer}
              entity_name="projects"
              showFields={["name"]}
              access="write"
              includeIds={attachedProjectIds}
              value={value}
              onChange={onChange}
              ariaLabel="Project"
              placeholder="Select project…"
              helpertext="Only projects you have write access to are shown"
            />
          )}
          span="full"
        />
        {resource.project && (
          <CommonField
            name="Owners"
            value={
              projectOwners.length ? (
                <UserAvatarList users={projectOwners} max={8} />
              ) : (
                <PlaceholderText />
              )
            }
            span="full"
          />
        )}
      </SidebarSection>

      <SidebarSection title="Template">
        <CommonField
          name="Template"
          value={
            resource.template ? (
              <EntityReference {...resource.template} />
            ) : null
          }
          span="full"
        />
        <CommonField
          name={
            <div className="flex items-center gap-1">
              <span>Template Version</span>
              {/* Changing the version goes through the variables dialog, as
                  the new version can add or drop input variables. */}
              {canEdit && (
                <span className="-my-1.5 inline-flex">
                  <EditAffordance
                    onClick={onEditVariables}
                    ariaLabel="Change template version"
                    title="Change template version"
                  />
                </span>
              )}
            </div>
          }
          value={withPendingChange(
            resource.sourceCodeVersion ? (
              <Entity entity={resource.sourceCodeVersion} />
            ) : null,
            "source_code_version_id",
          )}
          span="full"
        />
        {/* The IaC tool only applies to resources that keep TF state. */}
        {resource.storage && (
          <CommonEditableField<string | null>
            name="IaC Tool"
            canEdit={canEdit}
            value={resource.tool?.id ?? null}
            ariaLabel="Edit IaC tool"
            display={withPendingChange(
              resource.tool ? (
                <EntityReference
                  id={resource.tool.id}
                  entityName="tool"
                  provider={resource.tool.name}
                  display_name={toolLabel(resource.tool)}
                />
              ) : (
                <span>Global default</span>
              ),
              "tool_id",
            )}
            onSave={(value) => saveField({ toolId: value })}
            renderEditor={({ value, onChange }) => (
              <ToolSelect value={value} onChange={onChange} />
            )}
            span="full"
          />
        )}
      </SidebarSection>

      {resource.abstract === false && (
        <ResourceInfrastructureSection resource={resource} />
      )}

      <SidebarSection title="Relations">
        <CommonField
          name={
            <CountLabel label="Parents" count={parents.length} size="small" />
          }
          value={
            parents.length ? (
              <RelatedResources resources={parents} />
            ) : (
              <PlaceholderText />
            )
          }
          span="full"
        />
        <CommonField
          name={
            <CountLabel label="Children" count={children.length} size="small" />
          }
          value={
            children.length ? (
              <RelatedResources resources={children} />
            ) : (
              <PlaceholderText />
            )
          }
          span="full"
        />
      </SidebarSection>

      <SidebarDetailsSection entity={resource} />
    </EntitySidebar>
  );
};
