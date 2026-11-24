import { useCallback, useState } from "react";

import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { useEntityAction } from "../../common/hooks/useEntityAction";
import { notifyError } from "../../common/hooks/useNotification";
import { GqlSourceCode, SOURCE_CODE_QUERY } from "../../source_codes/graphql";
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Spinner,
} from "../../ui";
import { GqlExecutor } from "../graphql/transforms";

/**
 * Runs the executor once from a git branch or tag other than the configured
 * one. The configured ref is not changed.
 *
 * Executor admins only, for dry run too: a dry run also runs the ref's code
 * with the executor's credentials. The backend enforces it, `edit` is only
 * given to admins.
 */
export const RunFromRefButton = () => {
  const { ikApi } = useConfig();
  const { entity, actions } = useEntityProvider();
  const { runAction, loading: running } = useEntityAction();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sourceCode, setSourceCode] = useState<GqlSourceCode | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);

  const executor = entity as GqlExecutor | undefined;
  const sourceCodeId = executor?.sourceCode?.id ?? null;

  const isAdmin = actions.includes("edit");
  const canDryRun = isAdmin && actions.includes("dryrun");
  const canExecute = isAdmin && actions.includes("execute");

  const loadSourceCode = useCallback(async () => {
    if (!sourceCodeId) return;
    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        sourceCode: GqlSourceCode | null;
      }>(SOURCE_CODE_QUERY, { id: sourceCodeId });
      setSourceCode(response.sourceCode);
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi, sourceCodeId]);

  if (!executor || (!canDryRun && !canExecute)) return null;

  const openDialog = () => {
    setVersion(null);
    setBranch(null);
    setOpen(true);
    if (!sourceCode) loadSourceCode();
  };

  const closeDialog = () => setOpen(false);

  // the configured ref runs with the regular Execute / Dry run actions
  const gitTags = (sourceCode?.gitTags ?? []).filter(
    (tag) => tag !== executor.sourceCodeVersion,
  );
  const gitBranches = (sourceCode?.gitBranches ?? []).filter(
    (name) => name !== executor.sourceCodeBranch,
  );
  const gitTagMessages = sourceCode?.gitTagMessages ?? {};
  const gitBranchMessages = sourceCode?.gitBranchMessages ?? {};

  const configuredRef = executor.sourceCodeVersion
    ? `tag ${executor.sourceCodeVersion}`
    : executor.sourceCodeBranch
      ? `branch ${executor.sourceCodeBranch}`
      : "no ref";

  const run = async (action: "execute" | "dryrun") => {
    const queued = await runAction(
      action,
      version ? { sourceCodeVersion: version } : { sourceCodeBranch: branch },
    );
    if (queued) closeDialog();
  };

  const hasRef = Boolean(version || branch);

  return (
    <>
      <Button onClick={openDialog}>Run from ref</Button>
      <Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Run from another branch or tag</DialogTitle>
        <DialogContent>
          <p className="m-0 text-body2">
            Runs the executor once from the selected ref. The configured{" "}
            {configuredRef} stays unchanged.
          </p>
          {loading ? (
            <div className="flex justify-center p-6">
              <Spinner />
            </div>
          ) : (
            <div className="pt-2">
              <Autocomplete
                options={gitTags}
                value={version}
                onChange={(_, value) => {
                  setVersion(value);
                  if (value) setBranch(null);
                }}
                getOptionLabel={(option) =>
                  `${option} - ${gitTagMessages[option] || ""}`
                }
                label="Git Tag"
                fullWidth
                margin="normal"
                helperText="Select a git tag (clears the selected branch)"
              />
              <Autocomplete
                options={gitBranches}
                value={branch}
                onChange={(_, value) => {
                  setBranch(value);
                  if (value) setVersion(null);
                }}
                getOptionLabel={(option) =>
                  `${option} - ${gitBranchMessages[option] || ""}`
                }
                label="Git Branch"
                fullWidth
                margin="normal"
                helperText="Select a git branch (clears the selected tag)"
              />
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          {canDryRun ? (
            <Button onClick={() => run("dryrun")} disabled={!hasRef || running}>
              Dry run
            </Button>
          ) : null}
          {canExecute ? (
            <Button
              variant="contained"
              onClick={() => run("execute")}
              disabled={!hasRef || running}
            >
              Execute
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </>
  );
};
