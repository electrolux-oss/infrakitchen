import { useCallback, useMemo, useState } from "react";

import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { CommonField } from "../../common/components/CommonField";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  GqlSourceCode,
  SOURCE_CODE_QUERY,
  transformSourceCode,
} from "../../source_codes/graphql";
import { RefFolders, SourceCodeResponse } from "../../source_codes/types";
import { ExecutorUpdateFieldInput, EXECUTOR_UPDATE_MUTATION } from "../graphql";
import { ExecutorResponse } from "../types";

export interface SourceCodeConfigEditorProps {
  executor: ExecutorResponse;
  canEdit: boolean;
}

/**
 * Editable "Source Code Configuration" field for the executor overview.
 *
 * The git tag, branch and directory path are interdependent (the available
 * folders depend on the preselected tag or branch, and tag/branch are mutually
 * exclusive), so they are edited together in a single dialog rather than as
 * separate inline fields. The source code repository itself is frozen and is
 * shown read-only elsewhere on the overview.
 */
export const SourceCodeConfigEditor = ({
  executor,
  canEdit,
}: SourceCodeConfigEditorProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();

  const saveField = useCallback(
    async (input: ExecutorUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(EXECUTOR_UPDATE_MUTATION, {
          id: executor.id,
          input,
        });
        notify("Executor updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, executor.id, refreshEntity],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sourceCode, setSourceCode] = useState<SourceCodeResponse | null>(null);

  const [version, setVersion] = useState<string | null>(
    executor.sourceCodeVersion,
  );
  const [branch, setBranch] = useState<string | null>(
    executor.sourceCodeBranch,
  );
  const [folder, setFolder] = useState<string>(executor.sourceCodeFolder);

  const sourceCodeId = executor.sourceCode?.id ?? null;

  const loadSourceCode = useCallback(async () => {
    if (!sourceCodeId) return;
    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        sourceCode: GqlSourceCode | null;
      }>(SOURCE_CODE_QUERY, { id: sourceCodeId });
      if (response.sourceCode) {
        setSourceCode(transformSourceCode(response.sourceCode));
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
        ? (sourceCode.gitFoldersMap.find(
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
      size={12}
      value={
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 0.5,
            "&:hover .source-config-edit, &:focus-within .source-config-edit": {
              opacity: 1,
            },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {executor.sourceCodeVersion ? (
              <Typography variant="body2">
                Git Tag: {executor.sourceCodeVersion}
              </Typography>
            ) : executor.sourceCodeBranch ? (
              <Typography variant="body2">
                Branch: {executor.sourceCodeBranch}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: "text.disabled" }}>
                No tag or branch selected
              </Typography>
            )}
            <Typography variant="body2">
              Directory Path: {executor.sourceCodeFolder || "Not set"}
            </Typography>
          </Box>
          {canEdit ? (
            <Tooltip title="Edit">
              <IconButton
                className="source-config-edit"
                size="small"
                onClick={openDialog}
                aria-label="Edit source code configuration"
                sx={{
                  opacity: 0,
                  transition: "opacity 0.15s ease-in-out",
                  "&:focus-visible": { opacity: 1 },
                }}
              >
                <EditOutlinedIcon fontSize="small" />
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
                <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box sx={{ pt: 1 }}>
                  <Autocomplete
                    options={gitTags}
                    value={version}
                    onChange={(_, value) => handleVersionChange(value)}
                    getOptionLabel={(option) =>
                      `${option} - ${gitTagMessages[option] || ""}`
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Git Tag"
                        fullWidth
                        margin="normal"
                        helperText="Select a git tag (clears the selected branch)"
                      />
                    )}
                  />
                  <Autocomplete
                    options={gitBranches}
                    value={branch}
                    onChange={(_, value) => handleBranchChange(value)}
                    getOptionLabel={(option) =>
                      `${option} - ${gitBranchMessages[option] || ""}`
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Git Branch"
                        fullWidth
                        margin="normal"
                        helperText="Select a git branch (clears the selected tag)"
                      />
                    )}
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
                </Box>
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
        </Box>
      }
    />
  );
};

export default SourceCodeConfigEditor;
