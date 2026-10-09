import { useCallback, useEffect, useState } from "react";

import { Link as RouterLink } from "react-router";

import {
  Alert,
  Box,
  Button,
  Link,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";

import { CommonDialog } from "../../../common/components/dialogs/CommonDialog";
import { RelativeTime } from "../../../common/components/fields/RelativeTime";
import { useConfig } from "../../../common/context";
import { notify, notifyError } from "../../../common/hooks/useNotification";
import { LogsDialog } from "../../../common/LogsComponent";
import StatusChip from "../../../common/StatusChip";
import {
  GqlIacModule,
  GqlIacRun,
  IAC_RUNS_QUERY,
  isActiveRun,
  PLAN_IAC_MODULE_MUTATION,
} from "../../graphql";

const POLL_INTERVAL_MS = 3000;
const RUNS_SHOWN = 20;
// Value of the commit select that reveals the SHA field.
const PICK_COMMIT = "__commit__";

export const PlanChanges = ({ run }: { run: GqlIacRun }) => {
  if (run.toAdd === null) return null;
  if (run.toAdd + (run.toChange ?? 0) + (run.toDestroy ?? 0) === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        No changes
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", gap: 1, fontFamily: "monospace" }}>
      <Box component="span" sx={{ color: "success.main" }}>
        +{run.toAdd}
      </Box>
      <Box component="span" sx={{ color: "warning.main" }}>
        ~{run.toChange}
      </Box>
      <Box component="span" sx={{ color: "error.main" }}>
        -{run.toDestroy}
      </Box>
    </Box>
  );
};

interface IacStackDialogProps {
  sourceCodeId: string;
  defaultBranch: string | null;
  tags: string[];
  module: GqlIacModule;
  environmentName: string;
  // null for an environment that is run without regions
  region: string | null;
  configured: boolean;
  canPlan: boolean;
  onClose: () => void;
  // Called when a run was started or finished, so the grid shows it.
  onRunsChanged: () => unknown;
}

export const IacStackDialog = ({
  sourceCodeId,
  defaultBranch,
  tags,
  module,
  environmentName,
  region,
  configured,
  canPlan,
  onClose,
  onRunsChanged,
}: IacStackDialogProps) => {
  const { ikApi, linkPrefix } = useConfig();
  const [runs, setRuns] = useState<GqlIacRun[]>([]);
  const [total, setTotal] = useState(0);
  const [target, setTarget] = useState(defaultBranch ?? PICK_COMMIT);
  const [sha, setSha] = useState("");
  const [starting, setStarting] = useState(false);
  const [logsRun, setLogsRun] = useState<GqlIacRun | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      const response = await ikApi.graphqlRequest<{
        iacRuns: GqlIacRun[];
        iacRunsCount: number;
      }>(IAC_RUNS_QUERY, {
        sourceCodeId,
        modulePath: module.path,
        environmentName,
        region,
        range: [0, RUNS_SHOWN],
      });
      setRuns(response.iacRuns || []);
      setTotal(response.iacRunsCount ?? 0);
    } catch (error) {
      notifyError(error);
    }
  }, [ikApi, sourceCodeId, module.path, environmentName, region]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const active = runs.some(isActiveRun);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void loadRuns(), POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      onRunsChanged();
    };
  }, [active, loadRuns, onRunsChanged]);

  const pickingCommit = target === PICK_COMMIT;
  const shaValid = /^[0-9a-f]{7,40}$/.test(sha.trim());

  const plan = async () => {
    setStarting(true);
    try {
      await ikApi.graphqlRequest(PLAN_IAC_MODULE_MUTATION, {
        sourceCodeId,
        input: {
          modulePath: module.path,
          environmentName,
          region,
          ...(pickingCommit ? { sha: sha.trim() } : { ref: target }),
        },
      });
      notify(
        `Plan of ${module.name} in ${[environmentName, region].filter(Boolean).join(" ")} queued`,
        "success",
      );
      await loadRuns();
      onRunsChanged();
    } catch (error) {
      notifyError(error);
    } finally {
      setStarting(false);
    }
  };

  const commitLink = (commitSha: string) =>
    `${linkPrefix}source_codes/${sourceCodeId}/commits?sha=${commitSha}`;

  return (
    <CommonDialog
      open
      maxWidth="lg"
      fullWidth
      onClose={onClose}
      title={[module.name, environmentName, region].filter(Boolean).join(" · ")}
      content={
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontFamily: "monospace" }}
          >
            {module.path || "/"}
          </Typography>
          {!configured && (
            <Alert severity="warning">
              Configure the {environmentName} environment in the Environments
              tab before running this module.
            </Alert>
          )}
          {canPlan && (
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
              <TextField
                select
                size="small"
                label="Plan"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                sx={{ minWidth: 240 }}
                slotProps={{
                  htmlInput: { "aria-label": "Commit to plan" },
                  select: {
                    MenuProps: {
                      slotProps: { paper: { sx: { maxHeight: 360 } } },
                    },
                  },
                }}
              >
                {defaultBranch && (
                  <MenuItem value={defaultBranch}>
                    Latest on {defaultBranch}
                  </MenuItem>
                )}
                {tags.map((tag) => (
                  <MenuItem
                    key={tag}
                    value={tag}
                    sx={{ fontFamily: "monospace" }}
                  >
                    {tag}
                  </MenuItem>
                ))}
                <MenuItem value={PICK_COMMIT}>A specific commit…</MenuItem>
              </TextField>
              {pickingCommit && (
                <TextField
                  size="small"
                  label="Commit SHA"
                  value={sha}
                  onChange={(e) => setSha(e.target.value)}
                  error={sha !== "" && !shaValid}
                  helperText="Copy it from the Commits tab"
                  sx={{ minWidth: 340 }}
                  slotProps={{ htmlInput: { "aria-label": "Commit SHA" } }}
                />
              )}
              <Button
                variant="contained"
                disabled={
                  !configured ||
                  starting ||
                  active ||
                  (pickingCommit && !shaValid)
                }
                onClick={() => void plan()}
              >
                Plan
              </Button>
            </Box>
          )}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Runs
              {total > RUNS_SHOWN ? ` (latest ${RUNS_SHOWN} of ${total})` : ""}
            </Typography>
            {runs.length === 0 ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Not run yet.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Commit</TableCell>
                    <TableCell>Changes</TableCell>
                    <TableCell>By</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <StatusChip status={run.status.toLowerCase()} />
                      </TableCell>
                      <TableCell>{run.action}</TableCell>
                      <TableCell>
                        {run.sha ? (
                          <Link
                            component={RouterLink}
                            to={commitLink(run.sha)}
                            sx={{ fontFamily: "monospace" }}
                          >
                            {run.sha.slice(0, 7)}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {run.ref && (
                          <Typography
                            variant="caption"
                            component="span"
                            sx={{ ml: 1, color: "text.secondary" }}
                          >
                            {run.ref}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <PlanChanges run={run} />
                      </TableCell>
                      <TableCell>{run.creator?.identifier ?? "—"}</TableCell>
                      <TableCell>
                        <RelativeTime date={run.startedAt ?? run.createdAt} />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => setLogsRun(run)}>
                          Logs
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
          {logsRun && (
            <LogsDialog
              entityId={logsRun.id}
              action={logsRun.action}
              view="logs"
              onClose={() => setLogsRun(null)}
            />
          )}
        </Box>
      }
    />
  );
};
