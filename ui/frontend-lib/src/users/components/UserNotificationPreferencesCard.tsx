import { useCallback, useEffect, useMemo, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import { CommonDialog } from "../../common/components/CommonDialog";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  CREATE_NOTIFICATION_PREFERENCE_MUTATION,
  DELETE_NOTIFICATION_PREFERENCE_MUTATION,
  GqlNotificationPreference,
  NOTIFICATION_PREFERENCE_FIELD_MAP,
} from "../../notifications";
import { NotificationChannel } from "../../notifications/types";
import { EVENT_TYPE } from "../../utils";

const CHANNEL_OPTIONS: NotificationChannel[] = ["IN_APP", "SLACK"];

interface NotificationPreferenceDialogProps {
  userId: string;
  open: boolean;
  initialPreference: GqlNotificationPreference | null;
  onClose: () => void;
  onSaved: () => void;
}

const NotificationPreferenceDialog = ({
  userId,
  open,
  initialPreference,
  onClose,
  onSaved,
}: NotificationPreferenceDialogProps) => {
  const { ikApi } = useConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [eventType, setEventType] = useState(
    initialPreference?.eventType ?? "execute",
  );
  const [channels, setChannels] = useState<NotificationChannel[]>(
    initialPreference?.channels ?? ["IN_APP"],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setEventType(initialPreference?.eventType ?? "execute");
    setChannels(initialPreference?.channels ?? ["IN_APP"]);
  }, [initialPreference, open]);

  const handleToggleChannel = (channel: NotificationChannel) => {
    setChannels((previousChannels) => {
      if (previousChannels.includes(channel)) {
        return previousChannels.filter((entry) => entry !== channel);
      }

      return [...previousChannels, channel];
    });
  };

  const handleSave = async () => {
    if (channels.length === 0) {
      notifyError(new Error("Select at least one integration type."));
      return;
    }

    setIsLoading(true);
    try {
      if (initialPreference?.id) {
        await ikApi.graphqlRequest(DELETE_NOTIFICATION_PREFERENCE_MUTATION, {
          id: initialPreference.id,
        });
      }

      await ikApi.graphqlRequest(CREATE_NOTIFICATION_PREFERENCE_MUTATION, {
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
            <InputLabel id="user-notification-event-type-label">
              Event Type
            </InputLabel>
            <Select
              labelId="user-notification-event-type-label"
              label="Event Type"
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
            >
              {Object.values(EVENT_TYPE).map((eventOption) => (
                <MenuItem key={eventOption} value={eventOption}>
                  {eventOption}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl component="fieldset">
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Integration Type
            </Typography>
            <FormGroup>
              {CHANNEL_OPTIONS.map((channel) => (
                <FormControlLabel
                  key={channel}
                  control={
                    <Checkbox
                      checked={channels.includes(channel)}
                      onChange={() => handleToggleChannel(channel)}
                    />
                  }
                  label={channel}
                />
              ))}
            </FormGroup>
          </FormControl>
        </Box>
      }
      actions={
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={isLoading}>
            {initialPreference ? "Save" : "Create"}
          </Button>
        </Stack>
      }
    />
  );
};

const DeleteNotificationPreferenceButton = ({
  id,
  onDeleted,
}: {
  id: string;
  onDeleted: () => void;
}) => {
  const { ikApi } = useConfig();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await ikApi.graphqlRequest(DELETE_NOTIFICATION_PREFERENCE_MUTATION, {
        id,
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

  if (!isConfirming) {
    return (
      <Button
        variant="outlined"
        color="error"
        size="small"
        startIcon={<DeleteOutlineIcon />}
        onClick={() => setIsConfirming(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <Stack direction="row" spacing={1}>
      <Button
        variant="outlined"
        color="success"
        size="small"
        startIcon={<CheckIcon />}
        onClick={handleDelete}
        disabled={isLoading}
      >
        Confirm
      </Button>
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        startIcon={<CloseIcon />}
        onClick={() => setIsConfirming(false)}
        disabled={isLoading}
      >
        Cancel
      </Button>
    </Stack>
  );
};

const EditNotificationPreferenceButton = ({
  preference,
  onEdit,
}: {
  preference: GqlNotificationPreference;
  onEdit: (preference: GqlNotificationPreference) => void;
}) => {
  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<EditOutlinedIcon />}
      onClick={() => onEdit(preference)}
    >
      Edit
    </Button>
  );
};

export const UserNotificationPreferencesCard = (props: { user_id: string }) => {
  const { user_id } = props;
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
        renderCell: (params: GridRenderCellParams) =>
          (params.row.channels || []).join(", "),
      },
      {
        field: "createdAt",
        headerName: "Created",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime
            date={params.value}
            sx={{ fontSize: "0.75rem", display: "flex" }}
          />
        ),
      },
      {
        field: "edit",
        fetchFields: [],
        headerName: "Edit",
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => (
          <EditNotificationPreferenceButton
            preference={params.row}
            onEdit={handleOpenEdit}
          />
        ),
      },
      {
        field: "id",
        headerName: "Delete",
        sortable: false,
        hideable: false,
        renderCell: (params: GridRenderCellParams) => (
          <DeleteNotificationPreferenceButton
            id={params.value}
            onDeleted={handleRefresh}
          />
        ),
      },
    ],
    [handleOpenEdit, handleRefresh],
  );

  return (
    <>
      <OverviewCard
        name="Notification Preferences"
        description="Manage your event preferences and delivery channels."
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
      </OverviewCard>
      <NotificationPreferenceDialog
        userId={user_id}
        open={dialogOpen}
        initialPreference={selectedPreference}
        onClose={() => setDialogOpen(false)}
        onSaved={handleRefresh}
      />
    </>
  );
};
