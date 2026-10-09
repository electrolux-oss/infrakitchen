import { Box, Stack, Typography } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import { relativeTimeColumn } from "../../common/components/entity_table/tableColumns";
import { EVENT_TYPE } from "../../utils";
import { GqlUserNotification } from "../graphql";

import { humanizeNotificationValue, UNREAD_DOT_SX } from "./notificationFormat";
import { ReadToggleButton } from "./ReadToggleButton";

const NOTIFICATION_STATUS_OPTIONS = ["info", "success", "warning", "error"];

// Entity types that can have admins/owners (those with a Permissions tab)
const NOTIFICATION_ENTITY_TYPE_OPTIONS = [
  "executor",
  "integration",
  "project",
  "resource",
  "service",
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
    renderCell: (params: GridRenderCellParams<GqlUserNotification>) => {
      const { title, message, readAt } = params.row;
      const isUnread = !readAt;
      return (
        <Stack
          direction="row"
          sx={{ gap: 1.5, alignItems: "center", minWidth: 0, height: "100%" }}
        >
          <Box
            aria-label={isUnread ? "Unread" : undefined}
            sx={{
              ...UNREAD_DOT_SX,
              visibility: isUnread ? "visible" : "hidden",
            }}
          />
          <Stack sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{ fontWeight: isUnread ? 600 : 400 }}
            >
              {title || message}
            </Typography>
            {title && title !== message && (
              <Typography
                variant="caption"
                noWrap
                title={message}
                sx={{ color: "text.secondary" }}
              >
                {message}
              </Typography>
            )}
          </Stack>
        </Stack>
      );
    },
  },
  {
    field: "entityId",
    fetchFields: ["entityType", "entityId", "entityName"],
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
    renderCell: (params: GridRenderCellParams<GqlUserNotification>) => {
      const { entityId, entityType, entityName, readAt } = params.row;
      if (!entityId) return null;
      return (
        <Box
          sx={{ display: "contents" }}
          onClick={(event) => {
            if (!readAt && (event.target as Element).closest("a")) {
              onToggleRead(params.row);
            }
          }}
        >
          <Entity
            entity={{ id: entityId, entityType, name: entityName ?? entityId }}
            showLabel
          />
        </Box>
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
    renderCell: (params: GridRenderCellParams) =>
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
    renderCell: (params: GridRenderCellParams) =>
      humanizeNotificationValue(params.value),
  },
  relativeTimeColumn("createdAt", "Received", { sortField: "created_at" }),
  {
    field: "readAt",
    headerName: "",
    width: 60,
    sortable: false,
    hideable: false,
    renderCell: (params: GridRenderCellParams<GqlUserNotification>) => (
      <ReadToggleButton
        isRead={!!params.row.readAt}
        onClick={() => onToggleRead(params.row)}
      />
    ),
  },
];
