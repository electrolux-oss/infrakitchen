import { ReactNode, useState } from "react";

import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";

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
  placeholder?: string;
  /** Optional hook called when edit mode is opened. */
  onEditStart?: () => void;
}

/**
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
  isEqual,
  placeholder = "Not set",
  onEditStart,
}: InlineEditableFieldProps<T>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T>(value);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(value);
    onEditStart?.();
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const hasChanged = isEqual ? !isEqual(draft, value) : draft !== value;

  const save = async () => {
    if (!hasChanged) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
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
          alignItems: "flex-start",
          gap: 1,
          width: "100%",
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {renderEditor({ value: draft, onChange: setDraft })}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", pt: 1 }}>
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
      <Box sx={{ minWidth: 0 }}>
        {display ?? (
          <Typography variant="body2" sx={{ color: "text.disabled" }}>
            {placeholder}
          </Typography>
        )}
      </Box>
      {canEdit ? (
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
