import { useCallback, useMemo, useRef, useState } from "react";

import { UserAvatar } from "../../common";
import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableNameField } from "../../common/components/editors/EditableNameField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { MultiSelectEditor } from "../../common/components/editors/MultiSelectEditor";
import {
  CommonField,
  EntityReference,
} from "../../common/components/fields/CommonField";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { notifyError } from "../../common/hooks/useNotification";
import { SubscribeNotificationButton } from "../../resources/components/notifications/SubscribeNotificationButton";
import { IkEntity } from "../../types";
import { TextField } from "../../ui";
import { GqlUserShort, USERS_SHORT_QUERY } from "../../users/graphql";
import { getImageRepositoryUrl, GqlService } from "../graphql";
import {
  ServiceUpdateFieldInput,
  UPDATE_SERVICE_MUTATION,
} from "../graphql/mutations";
import { useServiceNotificationDialog } from "../hooks";

type UserOption = GqlUserShort & { displayName?: string | null };

const ECR_TEMPLATES_QUERY = `
  query EcrTemplates($filter: JSON, $range: [Int!]) {
    templates(filter: $filter, range: $range) {
      id
    }
  }
`;

const getUserLabel = (user: UserOption) => user.displayName || user.identifier;

const sameUserSet = (a: UserOption[] | null, b: UserOption[] | null) => {
  const x = (a || []).map((user) => user.id).sort();
  const y = (b || []).map((user) => user.id).sort();

  return x.length === y.length && x.join("|") === y.join("|");
};

const ownersDisplay = (owners: UserOption[] | null) => {
  if (!owners || owners.length === 0) {
    return <p className="m-0 text-body2 text-fg-muted">None</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {owners.map((owner) => (
        <UserAvatar
          key={owner.id}
          id={owner.id}
          identifier={owner.identifier}
        />
      ))}
    </div>
  );
};

export interface ServiceSidebarProps {
  service: GqlService;
  onSubscriptionChange?: () => void;
}

/**
 * Right context sidebar for the service detail page: groups the
 * service's description, relations and history so the main column can focus
 * on its policies, notifications and activity.
 */
export const ServiceSidebar = ({
  service,
  onSubscriptionChange,
}: ServiceSidebarProps) => {
  const { ikApi } = useConfig();
  const { actions } = useEntityProvider();
  const canEdit = actions.includes("edit");

  const { loading, isSubscribed, handleSubscribe, handleUnsubscribe } =
    useServiceNotificationDialog({
      serviceId: String(service.id),
      onSubscriptionChange,
    });

  const [users, setUsers] = useState<UserOption[]>([]);
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const ownersLoadedRef = useRef(false);

  const loadUsers = useCallback(async () => {
    if (ownersLoadedRef.current) {
      return;
    }

    ownersLoadedRef.current = true;

    try {
      const response = await ikApi.graphqlRequest<{ users: UserOption[] }>(
        USERS_SHORT_QUERY,
        {
          sort: ["identifier", "ASC"],
          range: [0, 999],
        },
      );
      setUsers(response.users || []);
    } catch (error) {
      ownersLoadedRef.current = false;
      notifyError(error);
    }
  }, [ikApi]);

  const [ecrTemplateIds, setEcrTemplateIds] = useState<string[] | null>(null);
  const loadEcrTemplates = useCallback(async () => {
    if (ecrTemplateIds !== null) return;
    try {
      const response = await ikApi.graphqlRequest<{
        templates: { id: string }[];
      }>(ECR_TEMPLATES_QUERY, {
        filter: { cloud_resource_types__contains_all: ["aws_ecr"] },
        range: [0, 999],
      });
      setEcrTemplateIds((response.templates || []).map((t) => t.id));
    } catch (error) {
      notifyError(error);
    }
  }, [ikApi, ecrTemplateIds]);

  const imageRepositoryUrl = getImageRepositoryUrl(service.imageResource);

  const saveField = useEntityFieldSaver<ServiceUpdateFieldInput>(
    UPDATE_SERVICE_MUTATION,
    service.id,
    "Service",
  );

  const ownerValues = useMemo<UserOption[]>(
    () =>
      (service.owners || []).map((owner) => {
        const loadedUser = users.find((user) => user.id === owner.id);
        return loadedUser || owner;
      }),
    [service.owners, users],
  );

  return (
    <EntitySidebar ariaLabel="Service details">
      <SidebarSection
        title="About"
        action={
          <SubscribeNotificationButton
            isSubscribed={isSubscribed}
            isLoading={loading}
            onSubscribeClick={() => {
              void handleSubscribe();
            }}
            onUnsubscribeClick={() => {
              void handleUnsubscribe();
            }}
            entityName="service"
            showIncludeChildren={false}
          />
        }
      >
        <EditableNameField
          value={service.name}
          canEdit={canEdit}
          onSave={(value) => saveField({ name: value })}
        />
        <EditableDescriptionField
          value={service.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <CommonEditableField<string>
          name={"Version"}
          canEdit={canEdit}
          value={service.version ?? ""}
          ariaLabel="Edit version"
          display={
            service.version || (
              <span className="text-body2 text-fg-muted">Not set</span>
            )
          }
          onSave={(value) => saveField({ version: value.trim() })}
          renderEditor={({ value, onChange }) => (
            <TextField
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="1.0.0"
              helperText="Each build also pushes this as an image tag, once per version. Leave empty to clear."
              aria-label="Version"
              fullWidth
              margin="normal"
              autoFocus
            />
          )}
          span="full"
        />
        <EditableTagsField
          value={service.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Relations">
        <CommonField
          name={"Project"}
          value={
            service.project ? (
              <EntityReference {...service.project} entityName="project" />
            ) : null
          }
          span="full"
        />
        <CommonEditableField<UserOption[]>
          name={"Owners"}
          canEdit={canEdit}
          value={ownerValues}
          ariaLabel="Edit owners"
          isEqual={sameUserSet}
          display={ownersDisplay(ownerValues)}
          onSave={(value) =>
            saveField({ owners: value.map((owner) => owner.id) })
          }
          onEditStart={loadUsers}
          renderEditor={({ value, onChange }) => (
            <MultiSelectEditor<UserOption>
              value={value}
              onChange={onChange}
              ariaLabel="Owners"
              placeholder="Select users"
              helperText="Users allowed to edit this service. Project owners can always edit it."
              options={users}
              getOptionLabel={getUserLabel}
            />
          )}
          span="full"
        />
        <CommonEditableField<string | null>
          name={"Code Repository"}
          canEdit={canEdit}
          value={service.sourceCodeId}
          ariaLabel="Edit code repository"
          display={
            service.sourceCode ? (
              <EntityReference
                id={service.sourceCode.id}
                entityName="source_code"
                name={service.sourceCode.identifier}
                provider={service.sourceCode.sourceCodeProvider}
                urlProvider={service.sourceCode.sourceCodeProvider}
              />
            ) : null
          }
          onSave={(value) => saveField({ sourceCodeId: value ?? "" })}
          renderEditor={({ value, onChange }) => (
            <ReferenceInput
              ikApi={ikApi}
              buffer={buffer}
              setBuffer={setBuffer}
              entity_name="source_codes"
              filter={{ repository_type: "application" }}
              sort={["source_code_url", "ASC"]}
              showFields={["identifier"]}
              value={value}
              onChange={onChange}
              ariaLabel="Code repository"
              placeholder="Select repository…"
              helpertext="Application repository with this service's code"
            />
          )}
          span="full"
        />
      </SidebarSection>

      <SidebarSection title="Image Build">
        <CommonEditableField<string | null>
          name={"Image Repository"}
          canEdit={canEdit}
          value={service.imageResourceId}
          ariaLabel="Edit image repository"
          display={
            service.imageResource ? (
              <div className="flex min-w-0 flex-col gap-1">
                <EntityReference
                  id={service.imageResource.id}
                  entityName="resource"
                  name={service.imageResource.name}
                />
                {imageRepositoryUrl ? (
                  <span className="text-body2 break-all text-fg-muted">
                    {imageRepositoryUrl}
                  </span>
                ) : (
                  <span className="text-body2 text-fg-muted">
                    No repository_url output yet
                  </span>
                )}
              </div>
            ) : null
          }
          onSave={(value) => saveField({ imageResourceId: value ?? "" })}
          onEditStart={loadEcrTemplates}
          renderEditor={({ value, onChange }) =>
            ecrTemplateIds === null ? (
              <TextField
                value=""
                disabled
                placeholder="Loading…"
                aria-label="Image repository"
                fullWidth
                margin="normal"
              />
            ) : (
              <ReferenceInput
                ikApi={ikApi}
                buffer={buffer}
                setBuffer={setBuffer}
                entity_name="resources"
                filter={{ template_id: ecrTemplateIds }}
                value={value}
                onChange={onChange}
                ariaLabel="Image repository"
                placeholder="Select ECR resource…"
                helpertext={
                  ecrTemplateIds.length > 0
                    ? "ECR resource the images are pushed to, with its AWS integration"
                    : "No template has the aws_ecr cloud resource type yet"
                }
              />
            )
          }
          span="full"
        />
        <CommonEditableField<string>
          name={"Dockerfile"}
          canEdit={canEdit}
          value={service.dockerfilePath}
          ariaLabel="Edit Dockerfile path"
          display={service.dockerfilePath}
          onSave={(value) => saveField({ dockerfilePath: value.trim() })}
          renderEditor={({ value, onChange }) => (
            <TextField
              value={value}
              onChange={(e) => onChange(e.target.value)}
              helperText="Path from the repository root"
              aria-label="Dockerfile path"
              fullWidth
              margin="normal"
              autoFocus
            />
          )}
          span="full"
        />
        <CommonEditableField<string>
          name={"Build Context"}
          canEdit={canEdit}
          value={service.buildContext}
          ariaLabel="Edit build context"
          display={service.buildContext}
          onSave={(value) => saveField({ buildContext: value.trim() })}
          renderEditor={({ value, onChange }) => (
            <TextField
              value={value}
              onChange={(e) => onChange(e.target.value)}
              helperText="Directory from the repository root, . for the root"
              aria-label="Build context"
              fullWidth
              margin="normal"
              autoFocus
            />
          )}
          span="full"
        />
      </SidebarSection>

      <SidebarDetailsSection entity={service} />
    </EntitySidebar>
  );
};
