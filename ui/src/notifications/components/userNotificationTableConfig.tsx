import { Entity } from "../../common/components/entities/Entity";
import { UnresolvedEntity } from "../../common/components/entities/UnresolvedEntity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { relativeTimeColumn } from "../../common/components/entity_table/tableColumns";
import { RenderCellParams } from "../../ui";
import { EVENT_TYPE } from "../../utils";
import { cn } from "../../utils/cn";
import { GqlUserNotification } from "../graphql";

import {
  humanizeNotificationValue,
  UNREAD_DOT_CLASSES,
} from "./notificationFormat";
import { ReadToggleButton } from "./ReadToggleButton";

const NOTIFICATION_STATUS_OPTIONS = ["info", "success", "warning", "error"];

// Entity types that can produce inbox notifications
const NOTIFICATION_ENTITY_TYPE_OPTIONS = [
  "executor",
  "resource",
  "source_code",
  "source_code_version",
  "storage",
  "tool",
  "workflow",
  "workspace",
];

export const userNotificationColumns = (
  onToggleRead: (notification: GqlUserNotification) => void,
): EntityTableColumn[] => [
  {
    field: "title",
    fetchFields: ["title", "message", "status", "readAt"],
    headerName: "Notification",
    flex: 3,
    sortable: false,
    hideable: false,
    filter: [
      {
        field: "title",
        operators: ["like", "not_like"],
        valueType: "text",
        defaultOperator: "like",
      },
      {
        field: "read",
        label: "Read State",
        operators: ["eq"],
        valueType: "select",
        defaultOperator: "eq",
        selectOptions: [
          { label: "Unread", value: "unread" },
          { label: "Read", value: "read" },
        ],
      },
    ],
    renderCell: (params: RenderCellParams<GqlUserNotification>) => {
      const { title, message, readAt } = params.row;
      const isUnread = !readAt;
      return (
        <div className="flex h-full min-w-0 flex-row items-center gap-3">
          <div
            aria-label={isUnread ? "Unread" : undefined}
            className={cn(
              UNREAD_DOT_CLASSES,
              isUnread ? "visible" : "invisible",
            )}
          />
          <div className="flex min-w-0 flex-col">
            <p
              className={cn(
                "m-0 truncate text-body2",
                isUnread ? "font-semibold" : "font-normal",
              )}
            >
              {title || message}
            </p>
            {title && title !== message && (
              <span
                className="truncate text-caption text-fg-muted"
                title={message}
              >
                {message}
              </span>
            )}
          </div>
        </div>
      );
    },
  },
  {
    field: "entityId",
    fetchFields: [
      "entityType",
      "entityId",
      "entityName",
      "entityData",
      "entityLoaderMissing",
    ],
    headerName: "Entity",
    flex: 2,
    sortable: false,
    filter: {
      field: "entity_type",
      label: "Entity Type",
      operators: ["eq", "in"],
      valueType: "autocomplete-multiple",
      defaultOperator: "in",
      options: NOTIFICATION_ENTITY_TYPE_OPTIONS,
    },
    renderCell: (params: RenderCellParams<GqlUserNotification>) => {
      const {
        entityId,
        entityType,
        entityName,
        entityData,
        entityLoaderMissing,
      } = params.row;
      if (!entityId) return null;
      // Entities with a loader that no longer resolve have been deleted
      if (!entityData && !entityLoaderMissing) {
        return (
          <UnresolvedEntity
            entityId={entityId}
            entityType={entityType}
            reason="deleted"
          />
        );
      }
      // The row click opens the entity (on the right tab) and marks the notification read
      return (
        <Entity
          entity={{
            ...entityData,
            id: entityId,
            entityType,
            name: entityData?.name ?? entityName ?? entityId,
          }}
          showLabel
          disableLink
        />
      );
    },
  },
  {
    field: "eventType",
    headerName: "Event",
    flex: 1,
    sortField: "event_type",
    filter: {
      field: "event_type",
      operators: ["eq", "in"],
      valueType: "autocomplete-multiple",
      defaultOperator: "in",
      options: Object.values(EVENT_TYPE),
    },
    renderCell: (params: RenderCellParams) =>
      humanizeNotificationValue(params.value),
  },
  {
    field: "status",
    headerName: "Severity",
    width: 110,
    sortField: "status",
    filter: {
      field: "status",
      operators: ["eq", "in"],
      valueType: "autocomplete-multiple",
      defaultOperator: "in",
      options: NOTIFICATION_STATUS_OPTIONS,
    },
    renderCell: (params: RenderCellParams) =>
      humanizeNotificationValue(params.value),
  },
  relativeTimeColumn("createdAt", "Received", { sortField: "created_at" }),
  {
    field: "readAt",
    headerName: "",
    width: 60,
    sortable: false,
    hideable: false,
    renderCell: (params: RenderCellParams<GqlUserNotification>) => (
      <ReadToggleButton
        isRead={!!params.row.readAt}
        onClick={() => onToggleRead(params.row)}
      />
    ),
  },
];
