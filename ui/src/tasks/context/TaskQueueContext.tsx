import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  camelizeKeys,
  useConfig,
  useEventProvider,
  usePermissionProvider,
} from "../../common/context";
import { GqlEntityQueueStatus } from "../../workers/graphql";
import {
  ACTIVE_TASK_QUEUE_FILTER,
  ACTIVE_TASK_QUEUE_QUERY,
  ActiveTaskStatus,
  GqlTaskQueueItem,
  QueueTask,
  TASK_QUEUE_ITEMS_BY_ID_QUERY,
} from "../graphql";

// Loaded in one request; a bigger backlog falls back to the server count
const SNAPSHOT_LIMIT = 500;
// Fallback when websocket events are not available
const POLL_INTERVAL_MS = 30_000;
// Events often come in bursts (claim, finish, next claim)
const DETAILS_DEBOUNCE_MS = 300;
// Finished ids are remembered so a stale query result can't bring them back
const FINISHED_MEMORY = 500;

const ACTIVE_STATUSES: readonly string[] = ["queued", "running"];

interface Entry extends QueueTask {
  /** When an event last changed this task; newer than a query means the query is stale for it. */
  eventAt?: number;
}

interface State {
  tasks: Record<string, Entry>;
  finished: string[];
  /** All active tasks are loaded, so the count can be taken from the store. */
  complete: boolean;
}

type Action =
  | { type: "event"; task: Partial<QueueTask> & { id: string }; at: number }
  | {
      type: "snapshot";
      tasks: QueueTask[];
      startedAt: number;
      complete: boolean;
    }
  | { type: "details"; tasks: QueueTask[] }
  | {
      type: "seed";
      entityId: string;
      tasks: QueueTask[];
      authoritative: boolean;
    }
  | { type: "remove"; id: string };

const remember = (finished: string[], id: string) =>
  finished.includes(id) ? finished : [...finished, id].slice(-FINISHED_MEMORY);

/** Fill details the newer state doesn't have from the older one. */
const keepDetails = (next: QueueTask, prev: QueueTask | undefined): Entry => ({
  ...next,
  entityData: next.entityData ?? prev?.entityData,
  creatorName: next.creatorName ?? prev?.creatorName,
  // Entity page queries don't carry the worker id, only its host
  workerHost:
    next.workerHost ??
    ((prev?.workerId ?? next.workerId) === next.workerId
      ? prev?.workerHost
      : undefined),
});

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "event": {
      const { task, at } = action;
      if (!ACTIVE_STATUSES.includes(task.status as string)) {
        if (!state.tasks[task.id] && state.finished.includes(task.id)) {
          return state;
        }
        const { [task.id]: _removed, ...tasks } = state.tasks;
        return { ...state, tasks, finished: remember(state.finished, task.id) };
      }
      if (state.finished.includes(task.id)) {
        return state;
      }
      const prev = state.tasks[task.id];
      const merged = keepDetails(
        {
          ...prev,
          ...task,
          createdAt:
            task.createdAt ?? prev?.createdAt ?? new Date(at).toISOString(),
          // A status change moves the task in the queue
          position: undefined,
          workerHost: undefined,
        } as QueueTask,
        prev,
      );
      return {
        ...state,
        tasks: { ...state.tasks, [task.id]: { ...merged, eventAt: at } },
      };
    }
    case "snapshot": {
      const { startedAt, complete } = action;
      const tasks: Record<string, Entry> = {};
      // Tasks changed by an event after the query started are newer than the query
      for (const [id, entry] of Object.entries(state.tasks)) {
        if ((entry.eventAt ?? 0) > startedAt || !complete) {
          tasks[id] = entry;
        }
      }
      for (const task of action.tasks) {
        if (state.finished.includes(task.id)) continue;
        const current = tasks[task.id];
        tasks[task.id] =
          current && (current.eventAt ?? 0) > startedAt
            ? keepDetails(current, task)
            : keepDetails(task, state.tasks[task.id]);
      }
      return { ...state, tasks, complete };
    }
    case "details": {
      const tasks = { ...state.tasks };
      for (const task of action.tasks) {
        const current = tasks[task.id];
        if (current) {
          tasks[task.id] = { ...current, ...keepDetails(current, task) };
        }
      }
      return { ...state, tasks };
    }
    case "seed": {
      const { entityId, authoritative } = action;
      const tasks = { ...state.tasks };
      if (authoritative) {
        for (const [id, entry] of Object.entries(tasks)) {
          if (entry.entityId === entityId) delete tasks[id];
        }
      }
      for (const task of action.tasks) {
        if (state.finished.includes(task.id)) continue;
        const current = tasks[task.id];
        // With live events the store is already newer; the query only adds details
        tasks[task.id] =
          current?.eventAt !== undefined
            ? { ...keepDetails(current, task), eventAt: current.eventAt }
            : keepDetails(task, current);
      }
      return { ...state, tasks };
    }
    case "remove": {
      const { [action.id]: _removed, ...tasks } = state.tasks;
      return {
        ...state,
        tasks,
        finished: remember(state.finished, action.id),
      };
    }
  }
};

const fromQueryItem = (item: GqlTaskQueueItem): QueueTask => ({
  id: item.id,
  entity: item.entity,
  entityId: item.entityId,
  action: item.action,
  status: item.status,
  createdAt: item.createdAt,
  availableAt: item.availableAt,
  startedAt: item.startedAt,
  retries: item.retries,
  maxRetries: item.maxRetries,
  createdBy: item.createdBy ?? item.creator?.id ?? null,
  workerId: item.workerId,
  entityData: item.entityData,
  creatorName: item.creator?.identifier ?? null,
  workerHost: item.workerHost,
});

const byCreatedAt = (a: QueueTask, b: QueueTask) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

export interface WorkerAvailability {
  workersFree: number;
  workersOnline: number;
}

interface TaskQueueContextType {
  /** Active tasks, oldest first. Without task read access only those of opened entity pages. */
  tasks: QueueTask[];
  /** Number of active tasks in the whole queue. */
  count: number;
  /** Whether `tasks` holds every active task (the backlog fits one request). */
  complete: boolean;
  loading: boolean;
  /** Reload the queue from the server (task read access only). */
  refresh: () => Promise<void>;
  /** Add an entity page's `taskQueueStatus` to the store. */
  seedEntity: (entityId: string, status: GqlEntityQueueStatus | null) => void;
  /** Drop a task right away, e.g. after the user cancelled it. */
  removeTask: (id: string) => void;
  /** Worker availability from the last entity page query. */
  workers: WorkerAvailability | null;
}

const TaskQueueContext = createContext<TaskQueueContextType | undefined>(
  undefined,
);

/**
 * Keeps the active task queue in the browser. A query loads it once, then every
 * queue change arrives as a `task_queue_item` event with the task's new state.
 * Without websocket events the queue is polled instead.
 */
export const TaskQueueProvider = ({ children }: { children: ReactNode }) => {
  const { ikApi, webSocketEnabled, globalConfig } = useConfig();
  const { permissions } = usePermissionProvider();
  const { event } = useEventProvider();
  const liveUpdates = !!webSocketEnabled && !!globalConfig?.websocket;
  const canReadTasks =
    permissions["*"] === "admin" || !!permissions["api:task"];

  const [state, dispatch] = useReducer(reducer, {
    tasks: {},
    finished: [],
    complete: false,
  });
  const [serverCount, setServerCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [workers, setWorkers] = useState<WorkerAvailability | null>(null);

  const refresh = useCallback(async () => {
    if (!canReadTasks) return;
    const startedAt = Date.now();
    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        taskQueueItems: GqlTaskQueueItem[];
        taskQueueItemsCount: number;
      }>(ACTIVE_TASK_QUEUE_QUERY, {
        filter: ACTIVE_TASK_QUEUE_FILTER,
        sort: ["created_at", "ASC"],
        range: [0, SNAPSHOT_LIMIT],
      });
      const items = response?.taskQueueItems ?? [];
      const total = response?.taskQueueItemsCount ?? items.length;
      setServerCount(total);
      dispatch({
        type: "snapshot",
        tasks: items.map(fromQueryItem),
        startedAt,
        complete: total <= items.length,
      });
    } catch {
      // The header badge isn't worth an error toast; the next refresh retries
    } finally {
      setLoading(false);
    }
  }, [ikApi, canReadTasks]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (liveUpdates || !canReadTasks) return;
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [liveUpdates, canReadTasks, refresh]);

  // Tasks first seen in an event lack the entity, creator and worker names
  const pendingDetails = useRef(new Set<string>());
  const detailsTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fetchDetails = useCallback(() => {
    const ids = [...pendingDetails.current];
    pendingDetails.current.clear();
    if (ids.length === 0) return;
    ikApi
      .graphqlRequest<{ taskQueueItems: GqlTaskQueueItem[] }>(
        TASK_QUEUE_ITEMS_BY_ID_QUERY,
        { filter: { id__in: ids } },
      )
      .then((response) =>
        dispatch({
          type: "details",
          tasks: (response?.taskQueueItems ?? []).map(fromQueryItem),
        }),
      )
      .catch(() => {});
  }, [ikApi]);
  useEffect(() => () => clearTimeout(detailsTimer.current), []);

  // Count of an incomplete store comes from the server
  const countTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const completeRef = useRef(state.complete);
  completeRef.current = state.complete;
  useEffect(() => () => clearTimeout(countTimer.current), []);

  useEffect(() => {
    const raw = event?._entity_name === "task" ? event.task_queue_item : null;
    if (!raw?.id) return;
    const task = camelizeKeys(raw) as Partial<QueueTask> & { id: string };
    dispatch({ type: "event", task, at: Date.now() });

    if (!canReadTasks) return;
    if (ACTIVE_STATUSES.includes(task.status as string)) {
      pendingDetails.current.add(task.id);
      clearTimeout(detailsTimer.current);
      detailsTimer.current = setTimeout(fetchDetails, DETAILS_DEBOUNCE_MS);
    }
    if (!completeRef.current) {
      clearTimeout(countTimer.current);
      countTimer.current = setTimeout(refresh, DETAILS_DEBOUNCE_MS);
    }
  }, [event, canReadTasks, fetchDetails, refresh]);

  const seedEntity = useCallback(
    (entityId: string, status: GqlEntityQueueStatus | null) => {
      if (status) {
        setWorkers({
          workersFree: status.workersFree,
          workersOnline: status.workersOnline,
        });
      }
      dispatch({
        type: "seed",
        entityId,
        authoritative: !liveUpdates,
        tasks: (status?.tasks ?? []).map((task) => ({
          id: task.id,
          entity: task.entity,
          entityId,
          action: task.action,
          status: task.status as ActiveTaskStatus,
          createdAt: task.createdAt,
          availableAt: task.availableAt,
          startedAt: task.startedAt,
          retries: task.retries,
          maxRetries: task.maxRetries,
          createdBy: task.creatorId,
          workerId: null,
          creatorName: task.creatorName,
          workerHost: task.workerHost,
          position: task.position,
        })),
      });
    },
    [liveUpdates],
  );

  const removeTask = useCallback(
    (id: string) => dispatch({ type: "remove", id }),
    [],
  );

  const tasks = useMemo(
    () => Object.values(state.tasks).sort(byCreatedAt),
    [state.tasks],
  );

  const value = useMemo<TaskQueueContextType>(
    () => ({
      tasks,
      count: state.complete ? tasks.length : serverCount,
      complete: state.complete,
      loading,
      refresh,
      seedEntity,
      removeTask,
      workers,
    }),
    [
      tasks,
      state.complete,
      serverCount,
      loading,
      refresh,
      seedEntity,
      removeTask,
      workers,
    ],
  );

  return (
    <TaskQueueContext.Provider value={value}>
      {children}
    </TaskQueueContext.Provider>
  );
};

export const useTaskQueue = () => {
  const context = useContext(TaskQueueContext);
  if (!context) {
    throw new Error("useTaskQueue must be used within a TaskQueueProvider");
  }
  return context;
};
