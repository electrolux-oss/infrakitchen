import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { HeroTrashIcon } from "../../icons";
import {
  Divider,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  TextField,
  Card,
  CardContent,
} from "../../ui";
import {
  CREATE_SCHEDULER_MUTATION,
  DELETE_SCHEDULER_MUTATION,
  SCHEDULERS_QUERY,
  UPDATE_SCHEDULER_MUTATION,
} from "../graphql";

const DEFAULT_SQL_EXAMPLES = [
  {
    description: "Cleanup expired logs older than 1 day",
    script:
      "DELETE from logs WHERE expire_at IS NOT NULL AND expire_at <= NOW() - INTERVAL '1 days'",
    cron: "*/30 * * * *",
  },
  {
    description: "Cleanup stale workers older than 1 hour",
    script: "DELETE FROM workers WHERE updated_at <= NOW() - INTERVAL '1 hour'",
    cron: "*/10 * * * *",
  },
  {
    description: "Cleanup expired caches older than 1 minute",
    script: "DELETE from caches WHERE expire_at <= NOW() - INTERVAL '1 mins'",
    cron: "*/5 * * * *",
  },
];

type SchedulerJobDTO = {
  id: string;
  type: "SQL" | "BASH";
  script: string;
  cron: string;
  createdAt: string;
};

export const SchedulerJobsSection = () => {
  const { ikApi } = useConfig();

  const [schedulerJobs, setSchedulerJobs] = useState<SchedulerJobDTO[]>([]);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [creatingSchedulerJob, setCreatingSchedulerJob] = useState(false);
  const [updatingSchedulerJob, setUpdatingSchedulerJob] = useState(false);
  const [deletingSchedulerJob, setDeletingSchedulerJob] = useState(false);
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

  const fetchSchedulerJobs = useCallback(async () => {
    try {
      setSchedulerLoading(true);
      const response = await ikApi.graphqlRequest<{
        schedulers: SchedulerJobDTO[];
      }>(SCHEDULERS_QUERY);
      setSchedulerJobs(response.schedulers);
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
      await ikApi.graphqlRequest(CREATE_SCHEDULER_MUTATION, {
        input: {
          type: "SQL",
          script,
          cron,
        },
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
      await ikApi.graphqlRequest(UPDATE_SCHEDULER_MUTATION, {
        id: editingSchedulerJobId,
        input: {
          type: editingSchedulerType,
          script,
          cron,
        },
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

  const handleDeleteSchedulerJob = async () => {
    if (!deleteDialogJobId) {
      return;
    }

    try {
      setDeletingSchedulerJob(true);
      await ikApi.graphqlRequest(DELETE_SCHEDULER_MUTATION, {
        id: deleteDialogJobId,
      });
      if (editingSchedulerJobId === deleteDialogJobId) {
        handleCancelEditSchedulerJob();
      }
      await fetchSchedulerJobs();
      notify("Scheduler job deleted", "success");
      setDeleteDialogJobId(null);
    } catch (error: any) {
      notifyError(error);
    } finally {
      setDeletingSchedulerJob(false);
    }
  };

  return (
    <>
      <BaseCard
        name="Scheduler Jobs"
        description="Create SQL scheduler jobs and manage reusable SQL templates"
        className="mt-8"
      >
        <div className="col-span-full">
          <h6 className="m-0 mb-4 text-subtitle1 font-semibold text-grey-500">
            Existing Jobs
          </h6>

          <div className="flex flex-col gap-3">
            {schedulerJobs.map((job) => (
              <Card key={job.id} variant="outlined">
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <h6 className="m-0 text-subtitle2 text-fg-muted">
                      {job.type} • {job.cron}
                    </h6>

                    {editingSchedulerJobId === job.id ? (
                      <div className="flex flex-col gap-3">
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
                        <div className="flex flex-row gap-2">
                          <Button
                            variant="contained"
                            onClick={handleUpdateSchedulerJob}
                            disabled={updatingSchedulerJob}
                          >
                            Save
                          </Button>
                          <Button
                            onClick={handleCancelEditSchedulerJob}
                            disabled={updatingSchedulerJob}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="m-0 text-body2 [word-break:break-word] whitespace-pre-wrap">
                          {job.script}
                        </p>
                        <div className="flex flex-row gap-2">
                          <Button
                            onClick={() => handleStartEditSchedulerJob(job)}
                          >
                            Edit
                          </Button>
                          <Button
                            color="error"
                            startIcon={<HeroTrashIcon />}
                            onClick={() => setDeleteDialogJobId(job.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {!schedulerLoading && schedulerJobs.length === 0 && (
              <p className="m-0 text-body2 text-fg-muted">
                No scheduler jobs found.
              </p>
            )}
          </div>
        </div>

        <div className="col-span-full">
          <Divider className="my-2" />
          <h6 className="m-0 mb-4 text-subtitle1 font-semibold text-grey-500">
            Create SQL Scheduler Job
          </h6>

          <div className="flex flex-col gap-4">
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
            <div>
              <h6 className="m-0 mb-2 text-subtitle2 text-fg-muted">
                SQL examples (click to paste)
              </h6>
              <div className="flex flex-col gap-2">
                {DEFAULT_SQL_EXAMPLES.map((example) => (
                  <Card
                    key={`${example.cron}-${example.script}`}
                    variant="outlined"
                  >
                    <CardContent className="p-3 last:pb-3">
                      <div className="flex flex-col gap-1.5">
                        <p className="m-0 text-body2 font-semibold">
                          {example.description}
                        </p>
                        <span className="text-caption text-fg-muted">
                          Cron: {example.cron}
                        </span>
                        <p className="m-0 text-body2 [word-break:break-word] whitespace-pre-wrap">
                          {example.script}
                        </p>
                        <div>
                          <Button
                            className="normal-case"
                            onClick={() => {
                              setNewSchedulerScript(example.script);
                              setNewSchedulerCron(example.cron);
                            }}
                          >
                            Use example
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            <div>
              <Button
                variant="contained"
                onClick={handleCreateSchedulerJob}
                disabled={creatingSchedulerJob || schedulerLoading}
              >
                Create Job
              </Button>
            </div>
          </div>
        </div>
      </BaseCard>

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
          <Button
            color="error"
            variant="contained"
            onClick={handleDeleteSchedulerJob}
            disabled={deletingSchedulerJob}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
