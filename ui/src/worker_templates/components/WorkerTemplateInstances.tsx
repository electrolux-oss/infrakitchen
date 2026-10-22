import { useCallback, useEffect, useState } from "react";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { Entity } from "../../common/components/entities/Entity";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { StatusLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context";
import {
  HeroArrowPathIcon,
  HeroCodeBracketIcon,
  HeroDocumentTextIcon,
} from "../../icons";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Label,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "../../ui";
import {
  GqlWorkerInstance,
  GqlWorkerInstanceManifest,
  WORKER_INSTANCE_MANIFEST_QUERY,
  GqlWorkerInstances,
  WORKER_INSTANCE_LOGS_QUERY,
  WORKER_TEMPLATE_INSTANCES_QUERY,
  WorkerInstancePhase,
} from "../graphql";

import { WorkerLogsDialog } from "./WorkerLogsDialog";

const REFRESH_INTERVAL_MS = 10_000;

const PHASE_COLORS: Record<
  WorkerInstancePhase,
  "success" | "warning" | "error" | "info" | "default"
> = {
  pending: "warning",
  running: "success",
  succeeded: "info",
  failed: "error",
  unknown: "default",
};

const ManifestDialog = ({
  workerTemplateId,
  instanceId,
  onClose,
}: {
  workerTemplateId: string;
  instanceId: string | null;
  onClose: () => void;
}) => {
  const { ikApi } = useConfig();
  const [manifest, setManifest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;
    setManifest("");
    setError(null);
    setLoading(true);
    ikApi
      .graphqlRequest<{ workerInstanceManifest: GqlWorkerInstanceManifest }>(
        WORKER_INSTANCE_MANIFEST_QUERY,
        { id: workerTemplateId, instanceId },
      )
      .then((response) => {
        if (cancelled) return;
        const result = response.workerInstanceManifest;
        setManifest(
          result.manifest ? JSON.stringify(result.manifest, null, 2) : "",
        );
        setError(result.error);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ikApi, workerTemplateId, instanceId]);

  return (
    <Dialog
      open={instanceId !== null}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>Manifest: {instanceId}</DialogTitle>
      <DialogContent>
        {loading && <Spinner size={20} />}
        {error && <Alert severity="error">{error}</Alert>}
        {manifest !== "" && (
          <pre className="max-h-[60vh] overflow-auto rounded bg-base-200 p-3 font-mono text-xs break-all whitespace-pre-wrap">
            {manifest}
          </pre>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const CurrentTask = ({ instance }: { instance: GqlWorkerInstance }) => {
  const task = instance.currentTask;
  if (!task || instance.workerStatus !== "busy") {
    return <span className="text-body2 text-fg-muted">—</span>;
  }
  return (
    <Entity
      entity={{
        id: task.entity_id,
        entityType: task.entity,
        name: `${task.entity} / ${task.action}`,
      }}
    />
  );
};

export const WorkerTemplateInstances = ({
  workerTemplateId,
}: {
  workerTemplateId: string;
}) => {
  const { ikApi } = useConfig();
  const [data, setData] = useState<GqlWorkerInstances | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [logsInstanceId, setLogsInstanceId] = useState<string | null>(null);
  const [manifestInstanceId, setManifestInstanceId] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        workerTemplateInstances: GqlWorkerInstances;
      }>(WORKER_TEMPLATE_INSTANCES_QUERY, { id: workerTemplateId });
      setData(response.workerTemplateInstances);
      setRequestError(null);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, [ikApi, workerTemplateId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const error = requestError ?? data?.error ?? null;
  const instances = data?.instances ?? [];

  return (
    <BaseCard
      name="Instances"
      description="Workers spawned from this template. Refreshes every 10 seconds."
      actions={
        <Tooltip title="Refresh">
          <IconButton onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Spinner size={20} />
            ) : (
              <HeroArrowPathIcon className="size-5" />
            )}
          </IconButton>
        </Tooltip>
      }
    >
      <div className="col-span-full">
        {error && <Alert severity="error">{error}</Alert>}
        {!error && data && instances.length === 0 && (
          <p className="text-body2 text-fg-muted">
            No workers are running. They are spawned when tasks are waiting.
          </p>
        )}
        {instances.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Phase</TableCell>
                  <TableCell>Worker</TableCell>
                  <TableCell>Current task</TableCell>
                  <TableCell>Tasks</TableCell>
                  <TableCell align="right">Started</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {instances.map((instance) => (
                  <TableRow key={instance.id}>
                    <TableCell>
                      <span className="font-mono text-body2">
                        {instance.id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={instance.reason ?? ""}>
                        <span>
                          <Label
                            label={instance.phase}
                            tone={PHASE_COLORS[instance.phase]}
                          />
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {instance.workerStatus ? (
                        <StatusLabel status={instance.workerStatus} />
                      ) : (
                        <span className="text-body2 text-fg-muted">
                          {instance.phase === "pending" ||
                          instance.phase === "running"
                            ? "starting"
                            : "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <CurrentTask instance={instance} />
                    </TableCell>
                    <TableCell>{instance.tasksCompleted ?? 0}</TableCell>
                    <TableCell align="right">
                      {instance.createdAt ? (
                        <RelativeTime date={instance.createdAt} compact />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Manifest">
                        <IconButton
                          onClick={() => setManifestInstanceId(instance.id)}
                        >
                          <HeroCodeBracketIcon className="size-5" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Logs">
                        <IconButton
                          onClick={() => setLogsInstanceId(instance.id)}
                        >
                          <HeroDocumentTextIcon className="size-5" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>
      <WorkerLogsDialog
        title={logsInstanceId}
        query={WORKER_INSTANCE_LOGS_QUERY}
        variables={{ id: workerTemplateId, instanceId: logsInstanceId }}
        resultKey="workerInstanceLogs"
        onClose={() => setLogsInstanceId(null)}
      />
      <ManifestDialog
        workerTemplateId={workerTemplateId}
        instanceId={manifestInstanceId}
        onClose={() => setManifestInstanceId(null)}
      />
    </BaseCard>
  );
};
