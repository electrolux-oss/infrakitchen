import { ReactNode, useEffect, useMemo, useState } from "react";

import { getDateValue } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { useNow } from "../../common/hooks/useNow";
import { formatTimeUntil } from "../../common/utils";
import { HeroClockIcon } from "../../icons";
import {
  useTaskQueue,
  WorkerAvailability,
} from "../../tasks/context/TaskQueueContext";
import { QueueTask } from "../../tasks/graphql";
import { Alert, AlertTitle, Button, Label } from "../../ui";
import {
  CANCEL_QUEUED_TASK_MUTATION,
  GqlEntityQueueStatus,
  GqlQueuedTask,
  TaskWaitingReason,
} from "../graphql";

const humanize = (value: string) =>
  value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** "Execute", or "Workspace sync" for a task queued under another controller. */
const taskLabel = (task: GqlQueuedTask, entityName: string) => {
  const action = humanize(task.action || "task");
  return task.entity === entityName
    ? action
    : `${humanize(task.entity)} ${action.toLowerCase()}`;
};

/** Live countdown until a just-requested task becomes available to workers. */
const StartsIn = ({ availableAt }: { availableAt: string }) => {
  const now = useNow();
  return (
    <>
      Starts {formatTimeUntil(availableAt, now)}. You can cancel it until then.
    </>
  );
};

const waitingReasonText = (
  task: GqlQueuedTask,
  entityName: string,
): Record<TaskWaitingReason, ReactNode> => {
  const position = task.position
    ? ` Position in queue: #${task.position}.`
    : "";
  return {
    entity_busy: `Waits for the running task on this ${humanize(entityName).toLowerCase()} to finish.`,
    retry_delay: (
      <>
        Dependencies are not ready yet. Retry {task.retries}/{task.maxRetries}
        {task.availableAt
          ? ` at ${getDateValue(task.availableAt)}.`
          : " starts soon."}
      </>
    ),
    cancel_window: task.availableAt ? (
      <StartsIn availableAt={task.availableAt} />
    ) : (
      "Starts shortly. You can cancel it until then."
    ),
    no_workers:
      "No workers are online. The task starts as soon as a worker becomes available.",
    workers_busy: `All workers are busy.${position}`,
    pending_pickup: `A worker will pick it up shortly.${position}`,
  };
};

const QueuedTaskRow = ({
  task,
  entityName,
  canCancel,
  onCancelled,
}: {
  task: GqlQueuedTask;
  entityName: string;
  canCancel: boolean;
  onCancelled: () => void;
}) => {
  const { ikApi } = useConfig();
  const [isCancelling, setIsCancelling] = useState(false);
  const running = task.status === "running";
  const requestedBy = task.creatorName ? <> by {task.creatorName}</> : null;

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await ikApi.graphqlRequest(CANCEL_QUEUED_TASK_MUTATION, { id: task.id });
      notify("Queued task cancelled", "success");
      onCancelled();
    } catch (error) {
      notifyError(error);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Label
          size="small"
          label={running ? "Running" : "Queued"}
          tone={running ? "info" : "default"}
        />
        <p className="m-0 text-body2 font-medium">
          {taskLabel(task, entityName)}
        </p>
        <span className="text-body2 text-fg-muted">
          {running ? (
            <>
              started <RelativeTime date={task.startedAt || task.createdAt} />
              {task.workerHost ? ` on ${task.workerHost}` : ""}
              {requestedBy}
            </>
          ) : (
            <>
              requested <RelativeTime date={task.createdAt} />
              {requestedBy}
            </>
          )}
        </span>
        {!running && canCancel && (
          <Button
            className="ml-auto"
            size="small"
            color="inherit"
            onClick={handleCancel}
            disabled={isCancelling}
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </Button>
        )}
      </div>
      {!running && task.waitingReason && (
        <p className="m-0 mt-0.5 text-body2 text-fg-muted">
          {waitingReasonText(task, entityName)[task.waitingReason]}
        </p>
      )}
    </div>
  );
};

const isLater = (date: string | null, now: number) =>
  !!date && new Date(date).getTime() > now;

/**
 * Why a queued task still waits, from what the browser knows: the time-based and
 * per-entity reasons are exact, worker availability is from the last entity query.
 */
const waitingReason = (
  task: QueueTask,
  all: QueueTask[],
  workers: WorkerAvailability | null,
  now: number,
): TaskWaitingReason => {
  const delayed = isLater(task.availableAt, now);
  if (delayed && task.retries === 0) return "cancel_window";
  const entityBusy = all.some(
    (other) =>
      other.id !== task.id &&
      other.status === "running" &&
      other.entity === task.entity &&
      other.entityId === task.entityId,
  );
  if (entityBusy) return "entity_busy";
  if (delayed) return "retry_delay";
  if (workers?.workersOnline === 0) return "no_workers";
  if (workers?.workersFree === 0) return "workers_busy";
  return "pending_pickup";
};

const toQueuedTask = (
  task: QueueTask,
  all: QueueTask[],
  workers: WorkerAvailability | null,
  now: number,
  currentUser: { id: string; identifier: string } | null,
): GqlQueuedTask => ({
  id: task.id,
  entity: task.entity,
  action: task.action,
  status: task.status,
  createdAt: task.createdAt,
  availableAt: task.availableAt,
  startedAt: task.startedAt,
  retries: task.retries,
  maxRetries: task.maxRetries,
  position: task.position ?? null,
  workerHost: task.workerHost ?? null,
  creatorId: task.createdBy,
  creatorName:
    task.creatorName ??
    (currentUser && task.createdBy === currentUser.id
      ? currentUser.identifier
      : null),
  waitingReason:
    task.status === "queued" ? waitingReason(task, all, workers, now) : null,
});

/**
 * Shows the entity's queued and running worker tasks on its overview page.
 * Starts from `taskQueueStatus`, which entity pages fetch together with the
 * entity, and follows the task queue store from there.
 * A queued task can be cancelled by its requester or an admin until a worker
 * picks it up; the server re-checks both.
 */
export const EntityTaskQueueStatus = () => {
  const { entity, entity_name, userEntityPermissions, fetchedAt } =
    useEntityProvider();
  const { currentUser, bootstrapPermissions } = useConfig();
  const { tasks: queueTasks, seedEntity, removeTask, workers } = useTaskQueue();
  const now = useNow();
  const entityId: string | undefined = entity?.id;
  const status = entity?.taskQueueStatus as GqlEntityQueueStatus | undefined;

  // Each entity query brings the queue state; events keep it current in between
  useEffect(() => {
    if (entityId && status !== undefined) {
      seedEntity(entityId, status, fetchedAt);
    }
    // fetchedAt changes together with status
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, status, seedEntity]);

  const tasks = useMemo(
    () =>
      queueTasks
        .filter((task) => entityId && task.entityId === entityId)
        .sort((a, b) =>
          a.status === b.status ? 0 : a.status === "running" ? -1 : 1,
        )
        .map((task) =>
          toQueuedTask(task, queueTasks, workers, now, currentUser),
        ),
    [queueTasks, entityId, workers, now, currentUser],
  );

  if (tasks.length === 0) {
    return null;
  }

  const isAdmin =
    userEntityPermissions.includes("admin") ||
    bootstrapPermissions?.["*"] === "admin";
  const queued = tasks.filter((task) => task.status === "queued");
  const noWorkers = queued.some((task) => task.waitingReason === "no_workers");
  const title =
    queued.length === 0
      ? "Task in progress"
      : queued.length === 1
        ? "Task waiting in queue"
        : `${queued.length} tasks waiting in queue`;

  return (
    <Alert
      className="w-full"
      severity={noWorkers ? "warning" : "info"}
      icon={<HeroClockIcon />}
    >
      <AlertTitle>{title}</AlertTitle>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <QueuedTaskRow
            key={task.id}
            task={task}
            entityName={entity_name}
            canCancel={
              isAdmin ||
              (!!currentUser?.id && task.creatorId === currentUser.id)
            }
            onCancelled={() => removeTask(task.id)}
          />
        ))}
      </div>
    </Alert>
  );
};
