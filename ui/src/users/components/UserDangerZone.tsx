import { useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import { DeleteButton } from "../../common/components/buttons/DeleteEntityButton";
import {
  DangerZoneAction,
  DangerZoneCard,
} from "../../common/components/cards/DangerZoneCard";
import { InlineCode } from "../../common/components/code/InlineCode";
import { useConfig } from "../../common/context";
import { notifyError } from "../../common/hooks/useNotification";
import { Spinner } from "../../ui";
import { ENTITY_ACTION } from "../../utils";
import { GqlUser } from "../graphql";
import {
  USER_DELETION_IMPACT_QUERY,
  UserDeletionImpact,
  UserDeletionImpactItem,
} from "../graphql/queries";

const TABLE_LABELS: Record<string, string> = {
  audit_logs: "audit log entries",
  casbin_rules: "role and policy assignments",
  favorites: "favorites",
  notification_preferences: "notification preferences",
  personal_access_tokens: "personal access tokens",
  project_owners: "project ownerships",
  resources_temp_state: "unsaved resource drafts",
  service_owners: "service ownerships",
  subscriptions: "notification subscriptions",
  tasks: "task history entries",
  user_notifications: "notifications",
};

const tableLabel = (table: string) =>
  TABLE_LABELS[table] ?? table.replaceAll("_", " ");

const ImpactList = ({ items }: { items: UserDeletionImpactItem[] }) => (
  <ul className="m-0 mt-1 list-disc pl-5">
    {items.map((item) => (
      <li key={item.table}>
        {item.count} {tableLabel(item.table)}
      </li>
    ))}
  </ul>
);

const DeletionImpactSummary = ({
  name,
  impact,
}: {
  name: string;
  impact: UserDeletionImpact | null;
}) => {
  if (!impact) {
    return (
      <div className="flex items-center gap-2">
        <Spinner size={16} /> Checking what will be deleted…
      </div>
    );
  }

  if (impact.blocking.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        <span>
          <InlineCode>{name}</InlineCode> cannot be deleted because it created
          entities that still exist. Delete them or deactivate the account
          instead:
        </span>
        <ImpactList items={impact.blocking} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span>
        This permanently deletes the service account{" "}
        <InlineCode>{name}</InlineCode>. This cannot be undone.
      </span>
      {impact.deleted.length > 0 && (
        <div>
          The following will also be deleted:
          <ImpactList items={impact.deleted} />
        </div>
      )}
      {impact.cleared.length > 0 && (
        <div>
          These records will be kept, without a link to this account:
          <ImpactList items={impact.cleared} />
        </div>
      )}
    </div>
  );
};

export const UserDangerZone = ({ user }: { user: GqlUser }) => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [impact, setImpact] = useState<UserDeletionImpact | null>(null);

  useEffect(() => {
    ikApi
      .graphqlRequest<{ userDeletionImpact: UserDeletionImpact }>(
        USER_DELETION_IMPACT_QUERY,
        { id: user.id },
      )
      .then((response) => setImpact(response.userDeletionImpact))
      .catch(notifyError);
  }, [ikApi, user.id]);

  const blocked = !impact || impact.blocking.length > 0;

  const actions = useMemo<DangerZoneAction[]>(
    () => [
      {
        key: ENTITY_ACTION.DELETE,
        label: "Delete",
        severity: "destructive",
        description: (
          <>
            Permanently deletes this service account with its tokens, role
            assignments and activity history.
          </>
        ),
        helperText: (
          <DeletionImpactSummary name={user.identifier} impact={impact} />
        ),
        renderDialogActions: (close) => (
          <DeleteButton
            onClose={close}
            onDelete={() => navigate(`${linkPrefix}/users`)}
            ikApi={ikApi}
            entity_name="user"
            entity_id={user.id}
            disabled={blocked}
          >
            Delete
          </DeleteButton>
        ),
        refreshAfterConfirm: false,
      },
    ],
    [user.id, user.identifier, impact, blocked, ikApi, linkPrefix, navigate],
  );

  return <DangerZoneCard dangerZoneActions={actions} />;
};
