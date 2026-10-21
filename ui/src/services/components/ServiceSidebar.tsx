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
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { notifyError } from "../../common/hooks/useNotification";
import { SubscribeNotificationButton } from "../../resources/components/notifications/SubscribeNotificationButton";
import { TextField, Link } from "../../ui";
import { GqlUserShort, USERS_SHORT_QUERY } from "../../users/graphql";
import { GqlService } from "../graphql";
import {
  ServiceUpdateFieldInput,
  UPDATE_SERVICE_MUTATION,
} from "../graphql/mutations";
import { useServiceNotificationDialog } from "../hooks";

type UserOption = GqlUserShort & { displayName?: string | null };

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
        <CommonEditableField<string | null>
          name={"Display Name"}
          canEdit={canEdit}
          value={service.displayName}
          ariaLabel="Edit display name"
          display={service.displayName || undefined}
          onSave={(value) => saveField({ displayName: value })}
          renderEditor={({ value, onChange }) => (
            <TextField
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
              aria-label="Display Name"
              fullWidth
              margin="normal"
              autoFocus
            />
          )}
          span="full"
        />
        <EditableDescriptionField
          value={service.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
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
        <CommonEditableField<string>
          name={"Repository"}
          canEdit={canEdit}
          value={service.repositoryUrl ?? ""}
          ariaLabel="Edit repository URL"
          display={
            service.repositoryUrl ? (
              <Link
                className="break-all"
                href={service.repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {service.repositoryUrl}
              </Link>
            ) : null
          }
          onSave={async (value) => {
            const trimmed = value.trim();
            if (trimmed && !/^https?:\/\/\S+$/.test(trimmed)) {
              notifyError(
                new Error("Repository URL must start with https:// or http://"),
              );
              throw new Error("Invalid repository URL");
            }
            await saveField({ repositoryUrl: trimmed });
          }}
          renderEditor={({ value, onChange }) => (
            <TextField
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://github.com/org/repo"
              aria-label="Repository URL"
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
