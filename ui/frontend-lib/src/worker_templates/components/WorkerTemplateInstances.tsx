import { useCallback, useEffect, useState } from "react";

import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Chip,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context";
import {
  GqlWorkerInstances,
  WORKER_TEMPLATE_INSTANCES_QUERY,
} from "../graphql";

const REFRESH_INTERVAL_MS = 10000;

const PHASE_COLORS: Record<
  string,
  "default" | "info" | "success" | "error" | "warning"
> = {
  pending: "warning",
  running: "success",
  succeeded: "info",
  failed: "error",
  unknown: "default",
};

interface WorkerTemplateInstancesProps {
  workerTemplateId: string;
}

export const WorkerTemplateInstances = ({
  workerTemplateId,
}: WorkerTemplateInstancesProps) => {
  const { ikApi } = useConfig();
  const [data, setData] = useState<GqlWorkerInstances | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await ikApi.graphqlRequest<{
        workerTemplateInstances: GqlWorkerInstances;
      }>(WORKER_TEMPLATE_INSTANCES_QUERY, { id: workerTemplateId });
      setData(response.workerTemplateInstances);
      setError(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, [ikApi, workerTemplateId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const instances = data?.instances ?? [];
  const message = error || data?.error;

  return (
    <BaseCard
      name="Worker Instances"
      actions={
        <Tooltip title="Refresh">
          <IconButton onClick={load} aria-label="Refresh instances">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      }
    >
      <Grid size={12}>
        {message && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}
        {instances.length === 0 && !message ? (
          <Typography color="text.secondary">
            No workers are running from this template. They are spawned when
            tasks are waiting for a worker.
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Instance</TableCell>
                  <TableCell>Phase</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {instances.map((instance) => (
                  <TableRow key={instance.id}>
                    <TableCell>{instance.id}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={instance.phase}
                        color={PHASE_COLORS[instance.phase] ?? "default"}
                      />
                    </TableCell>
                    <TableCell>
                      {instance.createdAt ? (
                        <RelativeTime date={instance.createdAt} />
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {Object.entries(instance.details || {})
                        .filter(
                          ([, value]) => value !== null && value !== false,
                        )
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Grid>
    </BaseCard>
  );
};
