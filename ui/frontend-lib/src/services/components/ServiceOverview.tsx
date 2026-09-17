import { useCallback, useMemo, useRef, useState } from "react";

import { Box, Link, TextField, Typography } from "@mui/material";

import { UserAvatar } from "../../common";
import { OverviewCard } from "../../common/components/cards/OverviewCard";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { MultiSelectEditor } from "../../common/components/editors/MultiSelectEditor";
import { CommonField } from "../../common/components/fields/CommonField";
import { GetReferenceUrlValue } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { SubscribeNotificationButton } from "../../resources/components/notifications/SubscribeNotificationButton";
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
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        None
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {owners.map((owner) => (
        <UserAvatar
          key={owner.id}
          id={owner.id}
          identifier={owner.identifier}
        />
      ))}
    </Box>
  );
};

interface ServiceOverviewProps {
  service: GqlService;
  onSubscriptionChange?: () => void;
}

export const ServiceOverview = ({
  service,
  onSubscriptionChange,
}: ServiceOverviewProps) => {
  const { ikApi } = useConfig();
  const { actions, refreshEntity } = useEntityProvider();
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

  const saveField = useCallback(
    async (input: ServiceUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_SERVICE_MUTATION, {
          id: service.id,
          input,
        });
        notify("Service updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, service.id, refreshEntity],
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
    <OverviewCard
      name={service.displayName || service.name}
      actions={
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
      <CommonEditableField<string>
        name={"Name"}
        canEdit={canEdit}
        value={service.name}
        ariaLabel="Edit name"
        display={<span>{service.name}</span>}
        onSave={(value) => saveField({ name: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            slotProps={{ input: { "aria-label": "Name" } }}
            fullWidth
            margin="normal"
            autoFocus
          />
        )}
        size={6}
      />
      <CommonEditableField<string | null>
        name={"Display Name"}
        canEdit={canEdit}
        value={service.displayName}
        ariaLabel="Edit display name"
        display={<span>{service.displayName || "-"}</span>}
        onSave={(value) => saveField({ displayName: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            slotProps={{ input: { "aria-label": "Display Name" } }}
            fullWidth
            margin="normal"
            autoFocus
          />
        )}
        size={6}
      />
      <CommonField
        name={"Project"}
        value={
          service.project ? (
            <GetReferenceUrlValue {...service.project} entityName="project" />
          ) : null
        }
        size={6}
      />
      <EditableDescriptionField
        value={service.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />
      <CommonEditableField<string>
        name={"Repository"}
        canEdit={canEdit}
        value={service.repositoryUrl ?? ""}
        ariaLabel="Edit repository URL"
        display={
          service.repositoryUrl ? (
            <Link
              href={service.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ wordBreak: "break-all" }}
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
            slotProps={{ input: { "aria-label": "Repository URL" } }}
            fullWidth
            margin="normal"
            autoFocus
          />
        )}
        size={6}
      />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={service.createdAt} />}
        size={6}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={service.updatedAt} />}
        size={6}
      />
      <EditableTagsField
        value={service.labels || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ labels: value })}
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
        size={6}
      />
    </OverviewCard>
  );
};
