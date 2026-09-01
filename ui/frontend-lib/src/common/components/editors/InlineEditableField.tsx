import { ReactNode, useState } from "react";

import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { Box, CircularProgress, IconButton, Tooltip } from "@mui/material";

import { LockAffordance } from "./LockAffordance";
import { PlaceholderText } from "../PlaceholderDescription";

export interface InlineEditableFieldLock {
  /** Whether the field is currently locked. When locked, the lock icon
   * replaces the edit affordance and clicking it unlocks the field. */
  locked: boolean;
  onToggle: () => void;
  /** Tooltip heading shown on the lock icon while locked. */
  lockedTitle: string;
  /** Tooltip body shown on the lock icon while locked. */
  lockedDescription?: string;
  /** Tooltip heading shown on the lock-open icon while unlocked. */
  unlockedTitle: string;
  /** Tooltip body shown on the lock-open icon while unlocked. */
  unlockedDescription?: string;
}

export interface InlineEditableFieldProps<T> {
  /** Current persisted value. */
  value: T;
  /** Read-only rendering shown when not editing. */
  display: ReactNode;
  /** Whether the current user is allowed to edit this field. */
  canEdit: boolean;
  /**
   * Persists the new value. Should throw on failure so the editor stays open;
   * the caller is responsible for surfacing the error to the user.
   */
  onSave: (value: T) => Promise<void>;
  /** Renders the type-specific editor while in edit mode. */
  renderEditor: (args: { value: T; onChange: (value: T) => void }) => ReactNode;
  /** Tooltip shown on the disabled edit icon when the user lacks permission. */
  disabledTooltip?: string;
  /** Accessible label for the edit affordance. */
  ariaLabel?: string;
  /** Optional custom equality check to detect changes for complex values. */
  isEqual?: (a: T, b: T) => boolean;
  /** Placeholder shown when there is no value to display. */
  placeholder?: string; /** Optional hook called when edit mode is opened. */
  onEditStart?: () => void;
  /** Optional lock affordance for protected fields. */
  lock?: InlineEditableFieldLock;
} /**
 * Generic click-to-edit field. Renders a read-only view with an edit affordance
 * and, when activated, swaps in a type-specific editor with explicit
 * save/cancel confirmation before persisting the change.
 */
export function InlineEditableField<T>({
  value,
  display,
  canEdit,
  onSave,
  renderEditor,
  disabledTooltip = "You do not have permission to edit this field",
  ariaLabel = "Edit field",
  // Default placeholder text lives in PlaceholderText ("Not set"); passing
  // undefined lets that default apply so the string isn't duplicated here.
  isEqual,
  placeholder,
  onEditStart,
  lock,
}: InlineEditableFieldProps<T>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T>(value);
  const [saving, setSaving] = useState(false);
  const startEdit = () => {
    setDraft(value);
    onEditStart?.();
    setEditing(true);
  };

  // Closes the editor and restores the read-only view. If the field is
  // protected by a lock, re-lock it so it is safeguarded again by default
  // once editing finishes (whether saved or cancelled).
  const closeEditor = () => {
    setEditing(false);
    setDraft(value);
    if (lock && !lock.locked) {
      lock.onToggle();
    }
  };

  const cancel = () => {
    closeEditor();
  };

  const hasChanged = isEqual ? !isEqual(draft, value) : draft !== value;

  const save = async () => {
    if (!hasChanged) {
      closeEditor();
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      closeEditor();
    } catch {
      // Keep the editor open; the error is surfaced by the caller.
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          width: "100%",
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {renderEditor({ value: draft, onChange: setDraft })}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {saving ? (
            <CircularProgress size={20} sx={{ mx: 1 }} />
          ) : (
            <>
              <Tooltip title="Save">
                <span>
                  <IconButton
                    size="small"
                    color="success"
                    onClick={save}
                    aria-label="Save change"
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton
                  size="small"
                  color="error"
                  onClick={cancel}
                  aria-label="Cancel edit"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        maxWidth: "100%",
        // Reveal the edit affordance on hover/focus for a cleaner default view.
        "&:hover .inline-edit-action, &:focus-within .inline-edit-action": {
          opacity: 1,
        },
      }}
    >
      {" "}
      <Box sx={{ minWidth: 0 }}>
        {display ?? <PlaceholderText text={placeholder} />}
      </Box>
      {lock ? (
        <>
          <LockAffordance
            locked={lock.locked}
            onClick={lock.onToggle}
            title={lock.locked ? lock.lockedTitle : lock.unlockedTitle}
            description={
              lock.locked ? lock.lockedDescription : lock.unlockedDescription
            }
          />
          {canEdit && !lock.locked && (
            <Tooltip title="Edit">
              <IconButton
                className="inline-edit-action"
                size="small"
                onClick={startEdit}
                aria-label={ariaLabel}
                sx={{
                  opacity: 0,
                  transition: "opacity 0.15s ease-in-out",
                  "&:focus-visible": { opacity: 1 },
                }}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </>
      ) : canEdit ? (
        <Tooltip title="Edit">
          <IconButton
            className="inline-edit-action"
            size="small"
            onClick={startEdit}
            aria-label={ariaLabel}
            sx={{
              opacity: 0,
              transition: "opacity 0.15s ease-in-out",
              "&:focus-visible": { opacity: 1 },
            }}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title={disabledTooltip}>
          <span>
            <IconButton
              className="inline-edit-action"
              size="small"
              disabled
              aria-label={ariaLabel}
              sx={{
                opacity: 0,
                transition: "opacity 0.15s ease-in-out",
              }}
            >
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      )}
    </Box>
  );
}

export default InlineEditableField;
