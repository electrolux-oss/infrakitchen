import { useCallback, useMemo, useState } from "react";

import { CommonField } from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { useConfig } from "../../common/context";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { HeroPencilSquareIcon } from "../../icons";
import { GqlSourceCode, SOURCE_CODE_QUERY } from "../../source_codes/graphql";
import { RefFolders } from "../../source_codes/types";
import {
  Autocomplete,
  Spinner,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "../../ui";
import {
  ExecutorUpdateFieldInput,
  EXECUTOR_UPDATE_MUTATION,
  GqlExecutor,
} from "../graphql";

export interface SourceCodeConfigEditorProps {
  executor: GqlExecutor;
  canEdit: boolean;
}

/**
 * Editable "Source Code Configuration" field for the executor configuration tab.
 *
 * The git tag, branch and directory path are interdependent (the available
 * folders depend on the preselected tag or branch, and tag/branch are mutually
 * exclusive), so they are edited together in a single dialog rather than as
 * separate inline fields. The source code repository itself is frozen and is
 * shown read-only next to it.
 */
export const SourceCodeConfigEditor = ({
  executor,
  canEdit,
}: SourceCodeConfigEditorProps) => {
  const { ikApi } = useConfig();

  const saveField = useEntityFieldSaver<ExecutorUpdateFieldInput>(
    EXECUTOR_UPDATE_MUTATION,
    executor.id,
    "Executor",
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sourceCode, setSourceCode] = useState<GqlSourceCode | null>(null);

  const [version, setVersion] = useState<string | null>(
    executor.sourceCodeVersion,
  );
  const [branch, setBranch] = useState<string | null>(
    executor.sourceCodeBranch,
  );
  const [folder, setFolder] = useState<string | null>(
    executor.sourceCodeFolder,
  );

  const sourceCodeId = executor.sourceCode?.id ?? null;

  const loadSourceCode = useCallback(async () => {
    if (!sourceCodeId) return;
    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        sourceCode: GqlSourceCode | null;
      }>(SOURCE_CODE_QUERY, { id: sourceCodeId });
      if (response.sourceCode) {
        setSourceCode(response.sourceCode);
      }
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi, sourceCodeId]);

  const openDialog = useCallback(() => {
    setVersion(executor.sourceCodeVersion);
    setBranch(executor.sourceCodeBranch);
    setFolder(executor.sourceCodeFolder);
    setDialogOpen(true);
    if (!sourceCode) {
      loadSourceCode();
    }
  }, [
    executor.sourceCodeVersion,
    executor.sourceCodeBranch,
    executor.sourceCodeFolder,
    sourceCode,
    loadSourceCode,
  ]);

  const closeDialog = () => setDialogOpen(false);

  const gitTags = sourceCode?.gitTags ?? [];
  const gitBranches = sourceCode?.gitBranches ?? [];
  const gitTagMessages = sourceCode?.gitTagMessages ?? {};
  const gitBranchMessages = sourceCode?.gitBranchMessages ?? {};

  const selectedRef = version ?? branch;
  const folderOptions = useMemo(() => {
    const refFolders =
      selectedRef && sourceCode
        ? (sourceCode.gitFoldersMap?.find(
            (r: RefFolders) => r.ref === selectedRef,
          )?.folders ?? [])
        : [];
    const options = new Set(refFolders);
    // Keep the current value selectable even if its ref data is not loaded yet.
    if (folder) options.add(folder);
    return Array.from(options);
  }, [selectedRef, sourceCode, folder]);

  const handleVersionChange = (value: string | null) => {
    setVersion(value);
    if (value) setBranch(null);
    setFolder("");
  };

  const handleBranchChange = (value: string | null) => {
    setBranch(value);
    if (value) setVersion(null);
    setFolder("");
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (!folder) {
        notify("Please select a directory path", "warning");
        return;
      }
      await saveField({
        sourceCodeVersion: version ?? undefined,
        sourceCodeBranch: branch ?? undefined,
        sourceCodeFolder: folder,
      });
      setDialogOpen(false);
    } catch {
      // Error is surfaced by saveField; keep the dialog open.
    } finally {
      setSaving(false);
    }
  }, [saveField, version, branch, folder]);

  return (
    <CommonField
      name={"Source Code Configuration"}
      span="full"
      value={
        <div className="flex items-start gap-1 [&:focus-within_.source-config-edit]:opacity-100 [&:hover_.source-config-edit]:opacity-100">
          <div className="min-w-0">
            {executor.sourceCodeVersion ? (
              <p className="m-0 text-body2">
                Git Tag: {executor.sourceCodeVersion}
              </p>
            ) : executor.sourceCodeBranch ? (
              <p className="m-0 text-body2">
                Branch: {executor.sourceCodeBranch}
              </p>
            ) : (
              <p className="m-0 text-body2 text-fg-disabled">
                No tag or branch selected
              </p>
            )}
            <p className="m-0 text-body2">
              Directory Path:{" "}
              {executor.sourceCodeFolder ? (
                executor.sourceCodeFolder
              ) : (
                <PlaceholderText />
              )}
            </p>
          </div>
          {canEdit ? (
            <Tooltip title="Edit">
              <IconButton
                className="source-config-edit opacity-0 [transition:opacity_0.15s_ease-in-out] focus-visible:opacity-100"
                size="small"
                onClick={openDialog}
                aria-label="Edit source code configuration"
              >
                <HeroPencilSquareIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}

          <Dialog
            open={dialogOpen}
            onClose={closeDialog}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Edit Source Code Configuration</DialogTitle>
            <DialogContent>
              {loading ? (
                <div className="flex justify-center p-6">
                  <Spinner />
                </div>
              ) : (
                <div className="pt-2">
                  <Autocomplete
                    options={gitTags}
                    value={version}
                    onChange={(_, value) => handleVersionChange(value)}
                    getOptionLabel={(option) =>
                      `${option} - ${gitTagMessages[option] || ""}`
                    }
                    label="Select Git Tag"
                    fullWidth
                    margin="normal"
                    helperText="Select a git tag (clears the selected branch)"
                  />
                  <Autocomplete
                    options={gitBranches}
                    value={branch}
                    onChange={(_, value) => handleBranchChange(value)}
                    getOptionLabel={(option) =>
                      `${option} - ${gitBranchMessages[option] || ""}`
                    }
                    label="Select Git Branch"
                    fullWidth
                    margin="normal"
                    helperText="Select a git branch (clears the selected tag)"
                  />
                  <TextField
                    select
                    label="Directory Path"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    fullWidth
                    margin="normal"
                    disabled={!selectedRef}
                    helperText={
                      selectedRef
                        ? "Select the directory path"
                        : "Select a tag or branch first"
                    }
                  >
                    {folderOptions.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </div>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDialog} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving || loading || !folder}
              >
                Save
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      }
    />
  );
};
