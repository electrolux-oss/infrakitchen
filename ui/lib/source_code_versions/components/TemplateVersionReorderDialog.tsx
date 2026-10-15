import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
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
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { useConfig } from "../../common";
import { deleteIconButtonStyle } from "../../common/components/buttons/deleteIconButtonStyle";
import { Entity } from "../../common/components/entities/Entity";
import { notify, notifyError } from "../../common/hooks/useNotification";
import VersionLifecycleStateChip from "../../common/VersionLifecycleStateChip";
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
      sourceCodeVersion
      sourceCodeBranch
      sourceCodeFolder
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
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());

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

  const handleDragStart = useCallback(
    (event: DragEvent, id: string, rowElement: HTMLElement | null) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
      if (rowElement) {
        const bounds = rowElement.getBoundingClientRect();
        event.dataTransfer.setDragImage(
          rowElement,
          event.clientX - bounds.left,
          event.clientY - bounds.top,
        );
      }
      setDraggedId(id);
    },
    [],
  );

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
      <DialogTitle>Manage Template Versions</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
            }}
          >
            Reorder, update lifecycle state, enable/disable, or delete versions
            for{" "}
            <Box component="span" sx={{ fontWeight: "bold" }}>
              {templateName}
            </Box>
            .
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
                  ref={(el: HTMLDivElement | null) => {
                    if (el) rowRefs.current.set(item.id, el);
                    else rowRefs.current.delete(item.id);
                  }}
                  variant="outlined"
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDrop={handleDrop}
                  sx={[
                    {
                      position: "relative",
                      transition: "opacity 120ms ease",
                    },
                    draggedId === item.id
                      ? {
                          opacity: 0.4,
                        }
                      : {},
                  ]}
                >
                  {(dropIndicatorIndex === index ||
                    (dropIndicatorIndex === index + 1 &&
                      index === items.length - 1)) && (
                    <Box
                      sx={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        ...(dropIndicatorIndex === index
                          ? { top: -5 }
                          : { bottom: -5 }),
                        height: 2,
                        borderRadius: 1,
                        bgcolor: "primary.main",
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                    />
                  )}
                  <Box
                    sx={{
                      width: "100%",
                      minHeight: 70,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 2,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        mr: 1.5,
                        borderRadius: "50%",
                        bgcolor: "action.selected",
                        color: "text.secondary",
                        fontSize: 12,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </Box>
                    <Box
                      component="span"
                      draggable
                      onDragStart={(event) =>
                        handleDragStart(
                          event,
                          item.id,
                          rowRefs.current.get(item.id) || null,
                        )
                      }
                      onDragEnd={handleDragEnd}
                      sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        mr: 1.5,
                        cursor: draggedId ? "grabbing" : "grab",
                      }}
                    >
                      <DragIndicatorIcon
                        sx={{
                          color: "text.secondary",
                          pointerEvents: "none",
                        }}
                      />
                    </Box>
                    <ListItemText
                      primary={
                        <Entity
                          entity={{
                            ...item,
                            entityType: "source_code_version",
                          }}
                          showLifecycleState={false}
                          disableLink
                        />
                      }
                      secondary={`${item.resourcesCount || 0} resources`}
                      sx={{ my: 0 }}
                    />
                    <TextField
                      select
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
                      slotProps={{
                        select: {
                          renderValue: (value) => (
                            <VersionLifecycleStateChip
                              lifecycleState={value as string}
                            />
                          ),
                        },
                      }}
                    >
                      {Object.values(VERSION_LIFECYCLE_STATE).map((option) => (
                        <MenuItem key={option} value={option}>
                          <VersionLifecycleStateChip lifecycleState={option} />
                        </MenuItem>
                      ))}
                    </TextField>
                    <Tooltip
                      title={
                        item.status === ENTITY_STATUS.DISABLED
                          ? "Enable version"
                          : "Disable version"
                      }
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          position: "relative",
                        }}
                      >
                        <Switch
                          size="small"
                          checked={item.status !== ENTITY_STATUS.DISABLED}
                          disabled={saving || togglingId === item.id}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => void handleToggleEnabled(item)}
                        />
                        {togglingId === item.id && (
                          <CircularProgress
                            size={16}
                            sx={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              marginTop: "-8px",
                              marginLeft: "-8px",
                            }}
                          />
                        )}
                      </span>
                    </Tooltip>
                    {(item.resourcesCount || 0) === 0 && (
                      <Tooltip title="Delete version">
                        <span>
                          <IconButton
                            size="small"
                            sx={deleteIconButtonStyle}
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
                            {deletingId === item.id ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : (
                              <DeleteOutlineIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </Box>
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
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
