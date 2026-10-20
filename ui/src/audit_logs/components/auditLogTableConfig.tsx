import { Fragment } from "react";

import {
  Entity,
  humanizeEntityType,
} from "../../common/components/entities/Entity";
import { UserAvatar } from "../../common/components/entities/UserAvatar";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  RELATIVE_TIME_COLUMN_WIDTH,
  userColumn,
} from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import { HeroInformationCircleIcon } from "../../icons";
import { Tooltip } from "../../ui";
import { RenderCellParams } from "../../ui";
import { Label } from "../../ui/Label";
import { GqlAuditLog } from "../graphql";
import { getAuditLogEntity } from "../utils/auditLogEntity";

import { AuditExecutionResult } from "./AuditExecutionResult";
import { DeletedEntityCell, DeniedEntityCell } from "./DeletedEntityCell";

/**
 * Merges the actor avatar with the relative time: an audit row reads as
 * "who, when" pairs in one narrow cell. Reusing userColumn() preserves the
 * user-reference filter.
 */
const userTimeColumn = (): EntityTableColumn => ({
  ...userColumn({ headerName: "Date", filterField: "user_id" }),
  // Label override: without it the filter dropdown would read "Date".
  filter: {
    field: "user_id",
    label: "User",
    operators: ["eq", "in"],
    valueType: "reference",
    defaultOperator: "eq",
    makeReferenceLoader: serverSearchReference({
      entityPlural: "users",
      labelField: "identifier",
    }),
  },
  sortable: false,
  // 112px (time column) + ~38px avatar.
  width: RELATIVE_TIME_COLUMN_WIDTH + 38,
  align: "right",
  headerAlign: "right",
  sortField: "created_at",
  fetchFields: ["creator", "createdAt"],
  renderCell: (params: RenderCellParams<GqlAuditLog>) => {
    const user = params.row.creator;
    return (
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        <RelativeTime date={params.row.createdAt} compact />
        {user?.id ? (
          <UserAvatar id={user.id} identifier={user.identifier} />
        ) : (
          <span className="text-caption">System</span>
        )}
      </div>
    );
  },
});

const AUDIT_LOG_ACTION_OPTIONS = [
  "approve",
  "cascade_destroy",
  "create",
  "delete",
  "destroy",
  "disable",
  "dryrun",
  "dryrun_with_temp_state",
  "edit",
  "enable",
  "execute",
  "link_accounts",
  "login",
  "recreate",
  "reject",
  "retry",
  "sync",
  "update",
];

export const auditLogColumns: EntityTableColumn[] = [
  {
    field: "entityId",
    fetchFields: [
      "model",
      "entityId",
      "entityData",
      "entityLoaderMissing",
      "action",
      "metadata",
    ],
    headerName: "Entity",
    flex: 2.5,
    sortable: false,
    hideable: false,
    valueGetter: (value: string) => value,
    renderCell: (params: RenderCellParams<GqlAuditLog>) => {
      if (params.row.metadata?.denied === "true") {
        return (
          <DeniedEntityCell
            entityType={params.row.model}
            action={params.row.action}
          />
        );
      }
      const { entity, isDeleted, unresolved } = getAuditLogEntity(params.row);
      // All rows show the entity UUID beneath the name for cross-
      // referencing; unresolvable entities render as "[Deleted]" (or, when
      // the model type has no server loader, "[No detail available]").
      const exists = !!entity;
      const uuidLine = params.row.entityId ? (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="font-mono text-caption break-all text-fg-muted">
            {params.row.entityId}
          </span>
          <Label size="small" label={humanizeEntityType(params.row.model)} />
        </div>
      ) : null;
      // Only chip the 1st row when it adds the nested template's name;
      // otherwise the type is already stated on the UUID row.
      const showTemplateChip = !!entity?.template?.name;
      return exists ? (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Entity
            entity={{
              ...entity,
              id: params.row.entityId,
              entityType: params.row.model,
              name: entity.name,
            }}
            showLifecycleState={false}
            showLabel={showTemplateChip}
            // Personal access tokens have no detail route — they are managed
            // on the owner's user page (Personal Access Tokens card). Feature
            // flags are likewise managed in the admin panel, not on a detail
            // route.
            disableLink={
              isDeleted ||
              params.row.model === "personal_access_token" ||
              params.row.model === "feature_flag"
            }
          />
          {uuidLine}
        </div>
      ) : (
        <DeletedEntityCell
          entityId={params.row.entityId}
          entityType={params.row.model}
          reason={unresolved ?? "deleted"}
        />
      );
    },
  },
  {
    field: "action",
    headerName: "Event",
    flex: 1,
    sortable: false,
    fetchFields: ["action", "metadata"],
    filter: {
      field: "action",
      operators: ["eq", "in"],
      valueType: "autocomplete-multiple",
      defaultOperator: "in",
      options: AUDIT_LOG_ACTION_OPTIONS,
    },
    renderCell: (params: RenderCellParams<GqlAuditLog>) => {
      // Personal access token authentications carry a token_prefix stamp in
      // their metadata; badge the event so token logins stand out from the
      // owner's own SSO/CLI logins at a glance.
      const isTokenAuth = params.row.metadata?.token_prefix != null;
      // Any other metadata payload (delete snapshots' extra fields, PAT auth
      // stamps, ...) is inspectable via the info tooltip. "execution" is
      // excluded: the Result column already renders it in rich form.
      const infoEntries = Object.entries(params.row.metadata ?? {}).filter(
        ([key]) => key !== "execution",
      );
      return (
        <div className="flex min-w-0 items-center gap-1.5">
          {params.value}
          {isTokenAuth && <Label size="small" label="PAT" tone="info" />}
          {infoEntries.length > 0 && (
            <Tooltip
              title={
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                  {infoEntries.map(([key, value]) => (
                    <Fragment key={key}>
                      <dt className="whitespace-nowrap text-fg-muted">{key}</dt>
                      <dd className="m-0 font-mono break-all">
                        {typeof value === "object" && value !== null
                          ? JSON.stringify(value)
                          : String(value)}
                      </dd>
                    </Fragment>
                  ))}
                </dl>
              }
              placement="bottom-start"
              className="max-w-[480px]"
            >
              <span
                className="inline-flex shrink-0 cursor-default items-center text-action-active"
                aria-label="Show event metadata"
              >
                <HeroInformationCircleIcon fontSize="small" />
              </span>
            </Tooltip>
          )}
        </div>
      );
    },
  },
  {
    field: "result",
    fetchFields: ["metadata"],
    headerName: "Result",
    flex: 2,
    sortable: false,
    valueGetter: (_value: unknown, row: GqlAuditLog) =>
      row.metadata?.execution ?? null,
    renderCell: (params: RenderCellParams<GqlAuditLog>) => {
      // Personal access token authentication rows carry their outcome in
      // metadata: a failed login sets ``reason`` (expired/revoked/invalid
      // credentials), a success has none. Permission denials set metadata.
      // ``denied`` and are rendered as a Denied error chip. All outcomes are
      // shown with the shared Label component; other rows keep the execution
      // result rendering.
      if (params.row.metadata?.denied === "true") {
        return <Label label="Denied" tone="error" />;
      }
      if (params.row.metadata?.token_prefix != null) {
        const reason =
          typeof params.row.metadata.reason === "string"
            ? params.row.metadata.reason
            : null;
        return reason ? (
          <Tooltip title={`Login failed: ${reason}`} placement="top">
            <span className="inline-flex">
              <Label label={reason} tone="error" />
            </span>
          </Tooltip>
        ) : (
          <Label label="Success" tone="success" />
        );
      }
      return <AuditExecutionResult log={params.row} />;
    },
  },
  userTimeColumn(),
];
