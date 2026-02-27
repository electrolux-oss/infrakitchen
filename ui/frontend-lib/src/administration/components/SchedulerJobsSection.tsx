import { useCallback, useEffect, useState } from "react";

import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useConfig } from "../../common";
import { DeleteButton } from "../../common/components/buttons/DeleteEntityButton";
import { notify, notifyError } from "../../common/hooks/useNotification";

const DEFAULT_SQL_EXAMPLES = [
  {
    description: "Cleanup expired logs older than 1 day",
    script:
      "DELETE from logs WHERE expire_at IS NOT NULL AND expire_at <= CURRENT_DATE - INTERVAL '1 days'",
    cron: "*/30 * * * *",
  },
  {
    description: "Cleanup stale workers older than 1 hour",
    script:
      "DELETE FROM workers WHERE updated_at <= CURRENT_DATE - INTERVAL '1 hour'",
    cron: "*/10 * * * *",
  },
  {
    description: "Cleanup expired caches older than 1 minute",
    script:
      "DELETE from caches WHERE expire_at <= CURRENT_DATE - INTERVAL '1 mins'",
    cron: "*/5 * * * *",
  },
];

type SchedulerJobDTO = {
  id: string;
  type: "SQL" | "BASH";
  script: string;
  cron: string;
  created_at: string;
};

export const SchedulerJobsSection = () => {
  const { ikApi } = useConfig();

  const [schedulerJobs, setSchedulerJobs] = useState<SchedulerJobDTO[]>([]);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [creatingSchedulerJob, setCreatingSchedulerJob] = useState(false);
  const [updatingSchedulerJob, setUpdatingSchedulerJob] = useState(false);
  const [deleteDialogJobId, setDeleteDialogJobId] = useState<string | null>(
    null,
  );

  const [editingSchedulerJobId, setEditingSchedulerJobId] = useState<
    string | null
  >(null);
  const [editingSchedulerType, setEditingSchedulerType] = useState<
    "SQL" | "BASH"
  >("SQL");
  const [editingSchedulerCron, setEditingSchedulerCron] = useState("");
  const [editingSchedulerScript, setEditingSchedulerScript] = useState("");

  const [newSchedulerCron, setNewSchedulerCron] = useState("0 * * * *");
  const [newSchedulerScript, setNewSchedulerScript] = useState("");

  const extractSchedulerJobs = (response: any): SchedulerJobDTO[] => {
    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.data)) {
      return response.data;
    }

    return [];
  };

  const fetchSchedulerJobs = useCallback(async () => {
    try {
      setSchedulerLoading(true);
      const response = await ikApi.get("schedulers");
      setSchedulerJobs(extractSchedulerJobs(response));
    } catch (error: any) {
      notifyError(error);
    } finally {
      setSchedulerLoading(false);
    }
  }, [ikApi]);

  useEffect(() => {
    fetchSchedulerJobs();
  }, [fetchSchedulerJobs]);

  const handleCreateSchedulerJob = async () => {
    const script = newSchedulerScript.trim();
    const cron = newSchedulerCron.trim();

    if (!script || !cron) {
      return;
    }

    try {
      setCreatingSchedulerJob(true);
      await ikApi.postRaw("schedulers", {
        type: "SQL",
        script,
        cron,
      });

      setNewSchedulerScript("");
      await fetchSchedulerJobs();
      notify("Scheduler job created", "success");
    } catch (error: any) {
      notifyError(error);
    } finally {
      setCreatingSchedulerJob(false);
    }
  };

  const handleStartEditSchedulerJob = (job: SchedulerJobDTO) => {
    setEditingSchedulerJobId(job.id);
    setEditingSchedulerType(job.type);
    setEditingSchedulerCron(job.cron);
    setEditingSchedulerScript(job.script);
  };

  const handleCancelEditSchedulerJob = () => {
    setEditingSchedulerJobId(null);
    setEditingSchedulerCron("");
    setEditingSchedulerScript("");
    setEditingSchedulerType("SQL");
  };

  const handleUpdateSchedulerJob = async () => {
    if (!editingSchedulerJobId) {
      return;
    }

    const script = editingSchedulerScript.trim();
    const cron = editingSchedulerCron.trim();

    if (!script || !cron) {
      return;
    }

    try {
      setUpdatingSchedulerJob(true);
      await ikApi.patchRaw(`schedulers/${editingSchedulerJobId}`, {
        type: editingSchedulerType,
        script,
        cron,
      });

      await fetchSchedulerJobs();
      handleCancelEditSchedulerJob();
      notify("Scheduler job updated", "success");
    } catch (error: any) {
      notifyError(error);
    } finally {
      setUpdatingSchedulerJob(false);
    }
  };

  return (
    <Box
      sx={{
        mt: 4,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        p: 3,
      }}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Scheduler Jobs
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Create SQL scheduler jobs and manage reusable SQL templates
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid
          size={{
            xs: 12,
            md: 12,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            Existing Jobs
          </Typography>

          <Stack spacing={1.5}>
            {schedulerJobs.map((job) => (
              <Card key={job.id} variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" color="textSecondary">
                      {job.type} • {job.cron}
                    </Typography>

                    {editingSchedulerJobId === job.id ? (
                      <Stack spacing={1.5}>
                        <TextField
                          select
                          label="Type"
                          value={editingSchedulerType}
                          onChange={(event) =>
                            setEditingSchedulerType(
                              event.target.value as "SQL" | "BASH",
                            )
                          }
                        >
                          <MenuItem value="SQL">SQL</MenuItem>
                          <MenuItem value="BASH">BASH</MenuItem>
                        </TextField>
                        <TextField
                          fullWidth
                          label="Cron expression"
                          value={editingSchedulerCron}
                          onChange={(event) =>
                            setEditingSchedulerCron(event.target.value)
                          }
                        />
                        <TextField
                          fullWidth
                          multiline
                          minRows={4}
                          label="Script"
                          value={editingSchedulerScript}
                          onChange={(event) =>
                            setEditingSchedulerScript(event.target.value)
                          }
                        />
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleUpdateSchedulerJob}
                            disabled={updatingSchedulerJob}
                          >
                            Save
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={handleCancelEditSchedulerJob}
                            disabled={updatingSchedulerJob}
                          >
                            Cancel
                          </Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <>
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {job.script}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleStartEditSchedulerJob(job)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<DeleteIcon />}
                            onClick={() => setDeleteDialogJobId(job.id)}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}

            {!schedulerLoading && schedulerJobs.length === 0 && (
              <Typography variant="body2" color="textSecondary">
                No scheduler jobs found.
              </Typography>
            )}
          </Stack>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="h6" sx={{ mb: 2 }}>
            Create SQL Scheduler Job
          </Typography>

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Cron expression"
              value={newSchedulerCron}
              onChange={(event) => setNewSchedulerCron(event.target.value)}
            />
            <TextField
              fullWidth
              multiline
              minRows={4}
              label="SQL script"
              value={newSchedulerScript}
              onChange={(event) => setNewSchedulerScript(event.target.value)}
            />
            <Box>
              <Typography
                variant="subtitle2"
                color="textSecondary"
                sx={{ mb: 1 }}
              >
                SQL examples (click to paste)
              </Typography>
              <Stack direction="column" spacing={1}>
                {DEFAULT_SQL_EXAMPLES.map((example) => (
                  <Card
                    key={`${example.cron}-${example.script}`}
                    variant="outlined"
                  >
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Stack spacing={0.75}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {example.description}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Cron: {example.cron}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {example.script}
                        </Typography>
                        <Box>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              setNewSchedulerScript(example.script);
                              setNewSchedulerCron(example.cron);
                            }}
                            sx={{ textTransform: "none" }}
                          >
                            Use example
                          </Button>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
            <Box>
              <Button
                variant="contained"
                onClick={handleCreateSchedulerJob}
                disabled={creatingSchedulerJob || schedulerLoading}
              >
                Create Job
              </Button>
            </Box>
          </Stack>
        </Grid>
      </Grid>

      <Dialog
        open={deleteDialogJobId !== null}
        onClose={() => setDeleteDialogJobId(null)}
      >
        <DialogTitle>Delete scheduler job?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this scheduler job? This action
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogJobId(null)}>Cancel</Button>
          <DeleteButton
            entity_name="scheduler"
            entity_id={deleteDialogJobId || ""}
            ikApi={ikApi}
            onDelete={() => {
              if (editingSchedulerJobId === deleteDialogJobId) {
                handleCancelEditSchedulerJob();
              }
              fetchSchedulerJobs();
            }}
            onClose={() => setDeleteDialogJobId(null)}
          >
            Delete
          </DeleteButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
