import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  MenuItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import { useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { getVersionLifecycleStateColor } from "../../common/VersionLifecycleStateChip";
import {
  ENTITY_ACTION,
  ENTITY_STATUS,
  VERSION_LIFECYCLE_STATE,
} from "../../utils/constants";
import {
  DELETE_SOURCE_CODE_VERSION_MUTATION,
  SOURCE_CODE_VERSION_ACTION_MUTATION,
  UPDATE_SOURCE_CODE_VERSION_MUTATION,
  SourceCodeVersionUpdateFieldInput,
} from "../graphql/mutations";
import { GqlSourceCodeVersionShort } from "../graphql/transforms";

const SOURCE_CODE_VERSIONS_BY_TEMPLATE_QUERY = `
  query SourceCodeVersionsByTemplate($filter: JSON, $sort: [String!], $range: [Int!]) {
    sourceCodeVersions(filter: $filter, sort: $sort, range: $range) {
      id
      identifier
      index
      entityName
      status
      lifecycleState
      breakingChanges
      resourcesCount
    }
    sourceCodeVersionsCount(filter: $filter)
  }
`;

interface TemplateVersionReorderDialogProps {
  open: boolean;
  templateId: string;
  templateName: string;
  onClose: () => void;
  onSaved?: () => void;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeLifecycleState(lifecycleState: string | null | undefined) {
  return (
    lifecycleState || VERSION_LIFECYCLE_STATE.UNKNOWN
  ).toLocaleLowerCase();
}

function getLifecycleRowSx(lifecycleState: string | null | undefined) {
  const color = getVersionLifecycleStateColor(lifecycleState || undefined);

  return (theme: any) => {
    if (color === "error") {
      return {
        backgroundColor: alpha(theme.palette.error.main, 0.08),
        borderColor: alpha(theme.palette.error.main, 0.3),
      };
    }

    if (color === "success") {
      return {
        backgroundColor: alpha(theme.palette.success.main, 0.08),
        borderColor: alpha(theme.palette.success.main, 0.3),
      };
    }

    if (color === "info") {
      return {
        backgroundColor: alpha(theme.palette.info.main, 0.08),
        borderColor: alpha(theme.palette.info.main, 0.3),
      };
    }

    if (color === "warning") {
      return {
        backgroundColor: alpha(theme.palette.warning.main, 0.08),
        borderColor: alpha(theme.palette.warning.main, 0.3),
      };
    }

    return {
      backgroundColor: alpha(theme.palette.grey[500], 0.12),
      borderColor: alpha(theme.palette.grey[500], 0.28),
    };
  };
}

export const TemplateVersionReorderDialog = ({
  open,
  templateId,
  templateName,
  onClose,
  onSaved,
}: TemplateVersionReorderDialogProps) => {
  const { ikApi } = useConfig();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<GqlSourceCodeVersionShort[]>([]);
  const [initialItems, setInitialItems] = useState<GqlSourceCodeVersionShort[]>(
    [],
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    if (!open || !templateId) return;

    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        sourceCodeVersions: GqlSourceCodeVersionShort[];
      }>(SOURCE_CODE_VERSIONS_BY_TEMPLATE_QUERY, {
        filter: { template_id: [templateId] },
        sort: ["index", "ASC"],
        range: [0, 1000],
      });
      const loadedItems = (response.sourceCodeVersions || []).map((item) => ({
        ...item,
        lifecycleState: normalizeLifecycleState(item.lifecycleState),
      }));
      setItems(loadedItems);
      setInitialItems(loadedItems);
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi, open, templateId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const isDirty = useMemo(
    () =>
      items.length !== initialItems.length ||
      items.some(
        (item, index) =>
          item.id !== initialItems[index]?.id ||
          item.lifecycleState !== initialItems[index]?.lifecycleState,
      ),
    [initialItems, items],
  );

  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropIndicatorIndex(null);
  }, []);

  const handleDragOver = useCallback(
    (event: DragEvent, targetIndex: number) => {
      event.preventDefault();

      if (!draggedId) {
        setDropIndicatorIndex(null);
        return;
      }

      const bounds = event.currentTarget.getBoundingClientRect();
      const offsetY = event.clientY - bounds.top;
      const ratio = bounds.height === 0 ? 0.5 : offsetY / bounds.height;
      const rawIndex = targetIndex + (ratio > 0.35 ? 1 : 0);
      const nextIndex = clamp(rawIndex, 0, items.length);

      setDropIndicatorIndex((current) =>
        current === nextIndex ? current : nextIndex,
      );
    },
    [draggedId, items.length],
  );

  const handleDrop = useCallback(() => {
    if (!draggedId || dropIndicatorIndex === null) return;

    setItems((current) => {
      const fromIndex = current.findIndex((item) => item.id === draggedId);
      if (fromIndex === -1) return current;

      const normalizedToIndex =
        fromIndex < dropIndicatorIndex
          ? dropIndicatorIndex - 1
          : dropIndicatorIndex;

      if (normalizedToIndex === fromIndex) return current;

      return moveItem(current, fromIndex, normalizedToIndex).map(
        (item, index) => ({
          ...item,
          index,
        }),
      );
    });
    setDraggedId(null);
    setDropIndicatorIndex(null);
  }, [draggedId, dropIndicatorIndex]);

  const handleLifecycleStateChange = useCallback(
    (id: string, lifecycleState: string) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                lifecycleState: normalizeLifecycleState(lifecycleState),
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleSave = useCallback(async () => {
    const changedItems = items.filter(
      (item, index) =>
        item.id !== initialItems[index]?.id ||
        item.lifecycleState !== initialItems[index]?.lifecycleState,
    );

    setSaving(true);
    try {
      await Promise.all(
        changedItems.map((item) =>
          ikApi.graphqlRequest(UPDATE_SOURCE_CODE_VERSION_MUTATION, {
            id: item.id,
            input: {
              index: item.index,
              lifecycleState: (
                item.lifecycleState || VERSION_LIFECYCLE_STATE.UNKNOWN
              ).toLocaleUpperCase(),
            } satisfies SourceCodeVersionUpdateFieldInput,
          }),
        ),
      );
      notify("Template version order updated", "success");
      onSaved?.();
      onClose();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  }, [ikApi, initialItems, items, onClose, onSaved]);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await ikApi.graphqlRequest(DELETE_SOURCE_CODE_VERSION_MUTATION, { id });
        notify("Template version deleted", "success");
        await loadVersions();
        onSaved?.();
      } catch (error) {
        notifyError(error);
      } finally {
        setDeletingId(null);
      }
    },
    [ikApi, loadVersions, onSaved],
  );

  const handleToggleEnabled = useCallback(
    async (item: GqlSourceCodeVersionShort) => {
      if (!item.status) return;

      const action =
        item.status === ENTITY_STATUS.DISABLED
          ? ENTITY_ACTION.ENABLE
          : ENTITY_ACTION.DISABLE;

      setTogglingId(item.id);
      try {
        await ikApi.graphqlRequest(SOURCE_CODE_VERSION_ACTION_MUTATION, {
          id: item.id,
          input: { action },
        });
        notify(
          action === ENTITY_ACTION.ENABLE
            ? "Template version enabled"
            : "Template version disabled",
          "success",
        );
        await loadVersions();
        onSaved?.();
      } catch (error) {
        notifyError(error);
      } finally {
        setTogglingId(null);
      }
    },
    [ikApi, loadVersions, onSaved],
  );

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Rearrange Template Versions</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Drag and drop versions for `{templateName}`. The saved order updates
            each version&apos;s index.
          </Typography>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <List
              sx={{ p: 0, display: "flex", flexDirection: "column", gap: 1 }}
            >
              {items.map((item, index) => (
                <Paper
                  key={item.id}
                  variant="outlined"
                  draggable
                  onDragStart={() => handleDragStart(item.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDrop={handleDrop}
                  sx={[
                    {
                      overflow: "hidden",
                      position: "relative",
                      transition: "box-shadow 120ms ease",
                    },
                    dropIndicatorIndex === index
                      ? {
                          boxShadow: (theme) =>
                            `0 -4px 0 ${theme.palette.primary.main}`,
                        }
                      : dropIndicatorIndex === index + 1
                        ? {
                            boxShadow: (theme) =>
                              `0 4px 0 ${theme.palette.primary.main}`,
                          }
                        : {},
                  ]}
                >
                  <ListItemButton
                    sx={[
                      {
                        width: "100%",
                        minHeight: 70,
                        alignItems: "center",
                        gap: 1.5,
                      },
                      getLifecycleRowSx(item.lifecycleState),
                      draggedId === item.id
                        ? {
                            bgcolor: "action.selected",
                            borderColor: "primary.main",
                          }
                        : {},
                    ]}
                  >
                    <DragIndicatorIcon
                      sx={{
                        mr: 1.5,
                        color: "text.secondary",
                        alignSelf: "center",
                      }}
                    />
                    <ListItemText
                      primary={item.identifier}
                      secondary={`Position ${index + 1} • ${item.resourcesCount || 0} resources`}
                      sx={{ my: 0 }}
                    />
                    {item.status !== ENTITY_STATUS.DISABLED && (
                      <IconButton
                        size="small"
                        color="warning"
                        disabled={saving || togglingId === item.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleToggleEnabled(item);
                        }}
                      >
                        <ToggleOnIcon fontSize="small" />
                      </IconButton>
                    )}
                    {item.status === ENTITY_STATUS.DISABLED && (
                      <IconButton
                        size="small"
                        color="primary"
                        disabled={saving || togglingId === item.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleToggleEnabled(item);
                        }}
                      >
                        <ToggleOffIcon fontSize="small" />
                      </IconButton>
                    )}
                    {(item.resourcesCount || 0) === 0 && (
                      <IconButton
                        size="small"
                        color="error"
                        disabled={
                          saving ||
                          deletingId === item.id ||
                          togglingId === item.id
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(item.id);
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                    <TextField
                      select
                      size="small"
                      label="Lifecycle State"
                      value={
                        item.lifecycleState || VERSION_LIFECYCLE_STATE.UNKNOWN
                      }
                      onChange={(event) =>
                        handleLifecycleStateChange(item.id, event.target.value)
                      }
                      onClick={(event) => event.stopPropagation()}
                      sx={{
                        ml: 2,
                        minWidth: 180,
                      }}
                    >
                      {Object.values(VERSION_LIFECYCLE_STATE).map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                  </ListItemButton>
                </Paper>
              ))}
            </List>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || loading || !isDirty}
        >
          Save Order
        </Button>
      </DialogActions>
    </Dialog>
  );
};
