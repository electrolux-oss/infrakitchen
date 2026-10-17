import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useConfig } from "../../common";
import { deleteIconButtonClass } from "../../common/components/buttons/deleteIconButtonClass";
import { Entity } from "../../common/components/entities/Entity";
import { notify, notifyError } from "../../common/hooks/useNotification";
import VersionLifecycleStateChip from "../../common/VersionLifecycleStateChip";
import { DeleteOutlinedIcon, DragIndicatorIcon } from "../../icons/material";
import {
  Spinner,
  Switch,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  ListItemText,
  TextField,
  List,
} from "../../ui";
import { cn } from "../../utils/cn";
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

// Highest index is the newest version and is shown first.
function toIndex(position: number, total: number) {
  return total - 1 - position;
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
  // Values as stored in the backend, keyed by id; used to send only real changes.
  const [storedById, setStoredById] = useState<
    Map<string, { index: number; lifecycleState: string }>
  >(new Map());
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
        sort: ["index", "DESC"],
        range: [0, 1000],
      });
      const storedItems = (response.sourceCodeVersions || []).map((item) => ({
        ...item,
        lifecycleState: normalizeLifecycleState(item.lifecycleState),
      }));
      const loadedItems = storedItems.map((item, position) => ({
        ...item,
        index: toIndex(position, storedItems.length),
      }));
      setStoredById(
        new Map(
          storedItems.map((item) => [
            item.id,
            { index: item.index, lifecycleState: item.lifecycleState },
          ]),
        ),
      );
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
        (item, position) => ({
          ...item,
          index: toIndex(position, current.length),
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
    const updates = items
      .map((item) => {
        const stored = storedById.get(item.id);
        const input: SourceCodeVersionUpdateFieldInput = {};
        if (item.index !== stored?.index) input.index = item.index;
        if (item.lifecycleState !== stored?.lifecycleState) {
          input.lifecycleState = (
            item.lifecycleState || VERSION_LIFECYCLE_STATE.UNKNOWN
          ).toLocaleUpperCase();
        }
        return { id: item.id, input };
      })
      .filter(({ input }) => Object.keys(input).length > 0);

    if (updates.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const results = await Promise.allSettled(
        updates.map(({ id, input }) =>
          ikApi.graphqlRequest(UPDATE_SOURCE_CODE_VERSION_MUTATION, {
            id,
            input,
          }),
        ),
      );
      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );

      onSaved?.();
      if (failures.length === 0) {
        notify("Template version order updated", "success");
        onClose();
      } else {
        notifyError(failures[0].reason);
        await loadVersions();
      }
    } finally {
      setSaving(false);
    }
  }, [ikApi, items, loadVersions, onClose, onSaved, storedById]);

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
        <div className="flex flex-col gap-4 pt-2">
          <p className="m-0 text-body2 text-fg-muted">
            Reorder, update lifecycle state, enable/disable, or delete versions
            for <span className="font-bold">{templateName}</span>.
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size={24} />
            </div>
          ) : (
            <List className="flex flex-col gap-2 p-0">
              {items.map((item, index) => (
                <div
                  className={cn(
                    "relative rounded-surface border border-divider bg-paper text-fg transition-opacity duration-[120ms]",
                    draggedId === item.id && "opacity-40",
                  )}
                  key={item.id}
                  ref={(el: HTMLDivElement | null) => {
                    if (el) rowRefs.current.set(item.id, el);
                    else rowRefs.current.delete(item.id);
                  }}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDrop={handleDrop}
                >
                  {(dropIndicatorIndex === index ||
                    (dropIndicatorIndex === index + 1 &&
                      index === items.length - 1)) && (
                    <div
                      className={cn(
                        "absolute right-0 left-0",
                        dropIndicatorIndex === index
                          ? "-top-1.25"
                          : "-bottom-1.25",
                        "pointer-events-none z-1 h-0.5 rounded-[8px] bg-primary",
                      )}
                    />
                  )}
                  <div className="flex min-h-17.5 w-full items-center gap-3 px-4">
                    <div className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-selected text-[12px] font-semibold text-fg-muted">
                      {index + 1}
                    </div>
                    <span
                      className={cn(
                        draggedId ? "cursor-grabbing" : "cursor-grab",
                        "mr-3 inline-flex items-center",
                      )}
                      draggable
                      onDragStart={(event) =>
                        handleDragStart(
                          event,
                          item.id,
                          rowRefs.current.get(item.id) || null,
                        )
                      }
                      onDragEnd={handleDragEnd}
                    >
                      <DragIndicatorIcon className="pointer-events-none text-fg-muted" />
                    </span>
                    <ListItemText
                      className="my-0"
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
                    />
                    <TextField
                      className="ml-4 min-w-45"
                      select
                      label="Lifecycle State"
                      value={
                        item.lifecycleState || VERSION_LIFECYCLE_STATE.UNKNOWN
                      }
                      onChange={(event) =>
                        handleLifecycleStateChange(item.id, event.target.value)
                      }
                      onClick={(event) => event.stopPropagation()}
                      selectProps={{
                        renderValue: (value) => (
                          <VersionLifecycleStateChip
                            lifecycleState={value as string}
                          />
                        ),
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
                          <Spinner
                            className="absolute top-[50%] left-[50%] mt-[-8px] ml-[-8px]"
                            size={16}
                          />
                        )}
                      </span>
                    </Tooltip>
                    {(item.resourcesCount || 0) === 0 && (
                      <Tooltip title="Delete version">
                        <span>
                          <IconButton
                            size="small"
                            className={deleteIconButtonClass}
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
                              <Spinner size={16} color="inherit" />
                            ) : (
                              <DeleteOutlinedIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </div>
                </div>
              ))}
            </List>
          )}
        </div>
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
