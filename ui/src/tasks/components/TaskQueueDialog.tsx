import { useState } from "react";

import { CommonDialog } from "../../common/components/dialogs/CommonDialog";
import { Entity } from "../../common/components/entities/Entity";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { StatusLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { useNow } from "../../common/hooks/useNow";
import { formatTimeUntil } from "../../common/utils";
import {
  HeroArrowPathIcon,
  HeroClockIcon,
  HeroQueueListIcon,
} from "../../icons";
import { Divider, Spinner, Button, IconButton, Tooltip, Badge } from "../../ui";
import { ENTITY_STATUS } from "../../utils/constants";
import { CANCEL_QUEUED_TASK_MUTATION } from "../../workers/graphql";
import { useTaskQueue } from "../context/TaskQueueContext";
import { QueueTask } from "../graphql";

// Enough to cover a real backlog without paging inside a dialog
const DIALOG_LIMIT = 100;

const humanize = (value: string) =>
  value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const actionLabel = (item: QueueTask) => {
  const action = humanize(item.action || "task");
  // Workspace syncs are queued under the resource they sync
  return item.entity === "workspace"
    ? `Workspace ${action.toLowerCase()}`
    : action;
};

const QueueRow = ({
  item,
  canCancel,
  onCancelled,
}: {
  item: QueueTask;
  canCancel: boolean;
  onCancelled: () => void;
}) => {
  const { ikApi } = useConfig();
  const [isCancelling, setIsCancelling] = useState(false);
  const now = useNow();
  const running = item.status === "running";
  const requestedBy = item.creatorName;
  // Just-requested tasks wait a few seconds so they can still be cancelled
  const startsAt =
    !running && item.retries === 0 && item.availableAt
      ? new Date(item.availableAt).getTime()
      : null;

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await ikApi.graphqlRequest(CANCEL_QUEUED_TASK_MUTATION, { id: item.id });
      notify("Queued task cancelled", "success");
      onCancelled();
    } catch (error) {
      notifyError(error);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="min-w-0 flex-1">
        {item.entityData ? (
          <Entity
            entity={{
              ...item.entityData,
              id: item.entityId ?? undefined,
              entityType: item.entityData.entityName ?? item.entity,
            }}
            showLabel
            noWrap
          />
        ) : (
          <p className="m-0 text-body2 font-medium">{humanize(item.entity)}</p>
        )}
        <div className="m-0 text-body2 text-fg-muted">
          {actionLabel(item)} ·{" "}
          {running ? (
            <>
              started <RelativeTime date={item.startedAt || item.createdAt} />
              {item.workerHost ? ` on ${item.workerHost}` : ""}
            </>
          ) : (
            <>
              queued <RelativeTime date={item.createdAt} />
              {startsAt && startsAt > now
                ? ` · starts ${formatTimeUntil(item.availableAt!, now)}`
                : ""}
            </>
          )}
          {requestedBy ? ` · by ${requestedBy}` : ""}
          {item.retries > 0
            ? ` · retry ${item.retries}/${item.maxRetries}`
            : ""}
        </div>
      </div>
      <StatusLabel
        status={running ? ENTITY_STATUS.IN_PROGRESS : ENTITY_STATUS.QUEUED}
      />
      {!running && canCancel && (
        <Button
          size="small"
          color="inherit"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? "Cancelling..." : "Cancel"}
        </Button>
      )}
    </div>
  );
};

/**
 * Header button on the Tasks page: shows how many tasks are waiting for or
 * running on a worker, and opens a dialog listing them. A queued task can be
 * cancelled by its requester or a super admin; entity admins can also cancel
 * it from the entity page. The server re-checks permissions.
 */
export const TaskQueueButton = ({
  variant = "button",
}: {
  /** "icon" is the compact header version next to the notification bell. */
  variant?: "button" | "icon";
}) => {
  const { currentUser, bootstrapPermissions, webSocketEnabled, globalConfig } =
    useConfig();
  const { tasks, count, loading, refresh, removeTask } = useTaskQueue();
  const liveUpdates = !!webSocketEnabled && !!globalConfig?.websocket;
  const isSuperAdmin = bootstrapPermissions?.["*"] === "admin";
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    // Live events keep the list current; without them it may be up to a poll behind
    if (!liveUpdates) refresh();
  };

  const items = tasks.slice(0, DIALOG_LIMIT);
  const running = items.filter((item) => item.status === "running");
  const queued = items.filter((item) => item.status === "queued");

  return (
    <>
      {variant === "icon" ? (
        <Tooltip title="Task queue">
          <IconButton
            className="border-0 bg-transparent hover:bg-transparent [&_svg]:size-4.5"
            size="small"
            aria-label={
              count > 0 ? `Task queue, ${count} active` : "Task queue"
            }
            onClick={handleOpen}
          >
            <Badge badgeContent={count} color="primary" max={99}>
              <HeroQueueListIcon />
            </Badge>
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="Tasks waiting for or running on a worker">
          <Badge badgeContent={count} color="primary" max={99}>
            <Button
              variant="outlined"
              startIcon={<HeroClockIcon />}
              onClick={handleOpen}
            >
              Queue
            </Button>
          </Badge>
        </Tooltip>
      )}
      <CommonDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Task queue"
        maxWidth="md"
        hasFooterActions={false}
        headerAction={
          <Tooltip title="Refresh">
            <span>
              <IconButton size="small" onClick={refresh} disabled={loading}>
                <HeroArrowPathIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        }
        content={
          loading && items.length === 0 ? (
            <div className="flex justify-center py-8">
              <Spinner size={28} />
            </div>
          ) : items.length === 0 ? (
            <p className="m-0 py-6 text-center text-body2 text-fg-muted">
              No tasks are waiting for a worker.
            </p>
          ) : (
            <div>
              <p className="m-0 mb-2 text-body2 text-fg-muted">
                {running.length} running · {queued.length} queued
                {count > items.length
                  ? ` · showing the oldest ${items.length}`
                  : ""}
              </p>
              {items.map((item, index) => (
                <div key={item.id}>
                  {index > 0 && <Divider />}
                  <QueueRow
                    item={item}
                    canCancel={
                      isSuperAdmin ||
                      (!!currentUser?.id && item.createdBy === currentUser.id)
                    }
                    onCancelled={() => removeTask(item.id)}
                  />
                </div>
              ))}
            </div>
          )
        }
      />
    </>
  );
};
