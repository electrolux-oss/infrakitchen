import { useCallback, useEffect, useMemo, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Box,
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import { deleteIconButtonStyle } from "../../common/components/buttons/deleteIconButtonStyle";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { CommonDialog } from "../../common/components/dialogs/CommonDialog";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { RELATIVE_TIME_COLUMN_WIDTH } from "../../common/components/entity_table/tableColumns";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { SlackLinkHint } from "../../common/providers/slack/SlackLinkHint";
import {
  SlackLinkState,
  useSlackLink,
} from "../../common/providers/slack/useSlackLink";
import {
  DELETE_NOTIFICATION_PREFERENCE_MUTATION,
  GqlNotificationPreference,
  NOTIFICATION_PREFERENCE_FIELD_MAP,
  UPSERT_NOTIFICATION_PREFERENCE_MUTATION,
} from "../../notifications";
import { NotificationChannel } from "../../notifications/types";
import { EVENT_TYPE } from "../../utils";

// In-app delivery is always on, so preferences only pick additional channels
const EXTERNAL_CHANNEL_OPTIONS: NotificationChannel[] = ["SLACK"];

const externalChannels = (channels: NotificationChannel[] = []) =>
  channels.filter((channel) => channel !== "IN_APP");

interface NotificationPreferenceDialogProps {
  userId: string;
  open: boolean;
  initialPreference: GqlNotificationPreference | null;
  slackLink: SlackLinkState;
  onClose: () => void;
  onSaved: () => void;
}

const NotificationPreferenceDialog = ({
  userId,
  open,
  initialPreference,
  slackLink,
  onClose,
  onSaved,
}: NotificationPreferenceDialogProps) => {
  const { ikApi } = useConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [eventType, setEventType] = useState(
    initialPreference?.eventType ?? "execute",
  );
  const [channels, setChannels] = useState<NotificationChannel[]>(
    initialPreference
      ? externalChannels(initialPreference.channels)
      : ["SLACK"],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setEventType(initialPreference?.eventType ?? "execute");
    setChannels(
      initialPreference
        ? externalChannels(initialPreference.channels)
        : ["SLACK"],
    );
  }, [initialPreference, open]);

  const handleSave = async () => {
    if (channels.length === 0) {
      notifyError(new Error("Select at least one additional channel."));
      return;
    }

    setIsLoading(true);
    try {
      await ikApi.graphqlRequest(UPSERT_NOTIFICATION_PREFERENCE_MUTATION, {
        input: {
          userId,
          eventType,
          channels,
        },
      });

      notify(
        initialPreference ? "Preference updated" : "Preference created",
        "success",
      );
      onSaved();
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title={
        initialPreference
          ? "Edit Notification Preference"
          : "Add Notification Preference"
      }
      maxWidth="sm"
      content={
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <FormControl fullWidth>
            <Typography
              id="user-notification-event-type-label"
              variant="subtitle2"
              sx={{ mb: 1 }}
            >
              Event type
            </Typography>
            <Select
              labelId="user-notification-event-type-label"
              value={eventType}
              disabled={!!initialPreference}
              onChange={(event) => setEventType(event.target.value)}
            >
              {Object.values(EVENT_TYPE).map((eventOption) => (
                <MenuItem key={eventOption} value={eventOption}>
                  {eventOption}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <Typography
              id="user-notification-channels-label"
              variant="subtitle2"
            >
              Additional channels
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", mb: 1 }}
            >
              In-app notifications are always delivered. Choose where else you
              want to receive this event.
            </Typography>
            <Select
              labelId="user-notification-channels-label"
              multiple
              value={channels}
              onChange={(event) =>
                setChannels(event.target.value as NotificationChannel[])
              }
              renderValue={(selected) => selected.join(", ")}
              sx={{ mb: 1 }}
            >
              {EXTERNAL_CHANNEL_OPTIONS.map((channel) => (
                <MenuItem
                  key={channel}
                  value={channel}
                  disabled={
                    channel === "SLACK" &&
                    !slackLink.integrationAvailable &&
                    !channels.includes(channel)
                  }
                >
                  {channel}
                </MenuItem>
              ))}
            </Select>
            <SlackLinkHint
              userId={userId}
              slackLink={slackLink}
              pendingNote="Slack messages start once the account is linked."
            />
          </FormControl>
        </Box>
      }
      actions={
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleSave} disabled={isLoading}>
            {initialPreference ? "Save" : "Create"}
          </Button>
        </Stack>
      }
    />
  );
};

const NotificationPreferenceActions = ({
  preference,
  onEdit,
  onDeleted,
}: {
  preference: GqlNotificationPreference;
  onEdit: (preference: GqlNotificationPreference) => void;
  onDeleted: () => void;
}) => {
  const { ikApi } = useConfig();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await ikApi.graphqlRequest(DELETE_NOTIFICATION_PREFERENCE_MUTATION, {
        id: preference.id,
      });
      notify("Preference deleted", "success");
      setIsConfirming(false);
      onDeleted();
    } catch (error) {
      notifyError(error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isConfirming) {
    return (
      <Stack direction="row">
        <IconButton
          title="Confirm delete"
          size="small"
          onClick={() => void handleDelete()}
          disabled={isLoading}
          sx={deleteIconButtonStyle}
        >
          <CheckIcon fontSize="small" />
        </IconButton>
        <IconButton
          title="Cancel"
          size="small"
          onClick={() => setIsConfirming(false)}
          disabled={isLoading}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    );
  }

  return (
    <Stack direction="row">
      <IconButton
        title="Edit Preference"
        size="small"
        onClick={() => onEdit(preference)}
      >
        <EditOutlinedIcon fontSize="small" />
      </IconButton>
      <IconButton
        title="Delete Preference"
        size="small"
        onClick={() => setIsConfirming(true)}
        sx={deleteIconButtonStyle}
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
};

export const UserNotificationPreferencesCard = (props: {
  user_id: string;
  slackId?: string | null;
}) => {
  const { user_id, slackId } = props;
  const slackLink = useSlackLink(user_id, slackId);
  const slackLinked = slackLink.isLinked;
  const [refreshKey, setRefreshKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPreference, setSelectedPreference] =
    useState<GqlNotificationPreference | null>(null);

  const handleOpenCreate = useCallback(() => {
    setSelectedPreference(null);
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback(
    (preference: GqlNotificationPreference) => {
      setSelectedPreference(preference);
      setDialogOpen(true);
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    setRefreshKey((currentKey) => currentKey + 1);
  }, []);

  const columns = useMemo(
    () => [
      {
        field: "eventType",
        headerName: "Event Type",
        flex: 1,
      },
      {
        field: "channels",
        headerName: "Integration Types",
        flex: 1,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            {externalChannels(params.row.channels).map((channel, index) => (
              <Box key={channel} component="span">
                {index > 0 && ", "}
                {channel}
                {channel === "SLACK" && !slackLinked && (
                  <Tooltip title="Not delivered: Slack account not linked">
                    <WarningAmberIcon
                      color="warning"
                      fontSize="inherit"
                      sx={{ ml: 0.5, verticalAlign: "middle" }}
                    />
                  </Tooltip>
                )}
              </Box>
            ))}
          </Stack>
        ),
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: RELATIVE_TIME_COLUMN_WIDTH,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime
            date={params.value}
            compact
            sx={{ display: "flex", justifyContent: "flex-end" }}
          />
        ),
      },
      {
        field: "id",
        headerName: "Actions",
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => (
          <NotificationPreferenceActions
            preference={params.row}
            onEdit={handleOpenEdit}
            onDeleted={handleRefresh}
          />
        ),
      },
    ],
    [handleOpenEdit, handleRefresh, slackLinked],
  );

  return (
    <>
      <BaseCard
        name="Notification Preferences"
        description="In-app notifications are always on. Add a preference to also receive an event type in Slack."
        actions={
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
          >
            Add Preference
          </Button>
        }
      >
        <EntityFetchTable
          key={refreshKey}
          title="User Notification Preferences"
          entityName="notificationPreference"
          columns={columns}
          defaultFilter={{ user_id }}
          entityFieldMap={NOTIFICATION_PREFERENCE_FIELD_MAP}
        />
      </BaseCard>
      <NotificationPreferenceDialog
        userId={user_id}
        open={dialogOpen}
        initialPreference={selectedPreference}
        slackLink={slackLink}
        onClose={() => setDialogOpen(false)}
        onSaved={handleRefresh}
      />
    </>
  );
};
