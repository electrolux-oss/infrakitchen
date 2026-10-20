import { ReactNode, useState } from "react";

import { createPortal } from "react-dom";

import { HeroCheckIcon, HeroXMarkIcon } from "../../../icons";
import { Spinner, IconButton, Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";
import { PlaceholderText } from "../fields/PlaceholderDescription";

import { EditAffordance } from "./EditAffordance";
import { LockAffordance } from "./LockAffordance";

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
  placeholder?: string;
  /** Optional hook called when edit mode is opened. */
  onEditStart?: () => void;
  /** Optional lock affordance for protected fields. */
  lock?: InlineEditableFieldLock;
  /**
   * Element (typically a slot in the field label) to render the edit/lock
   * affordance into. When provided the affordance is faintly visible there
   * instead of appearing beside the value on hover; pass `null` until the
   * slot has mounted.
   */
  affordanceContainer?: HTMLElement | null;
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
  // Default placeholder text lives in PlaceholderText ("Not set"); passing
  // undefined lets that default apply so the string isn't duplicated here.
  isEqual,
  placeholder,
  onEditStart,
  lock,
  affordanceContainer,
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
      <div className="flex w-full items-center gap-2">
        <div className="min-w-0 grow">
          {renderEditor({ value: draft, onChange: setDraft })}
        </div>
        <div className="flex items-center">
          {saving ? (
            <Spinner className="mx-2" size={20} />
          ) : (
            <>
              <Tooltip title="Save">
                <span>
                  <IconButton
                    size="small"
                    onClick={save}
                    aria-label="Save change"
                  >
                    <HeroCheckIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton
                  size="small"
                  onClick={cancel}
                  aria-label="Cancel edit"
                >
                  <HeroXMarkIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </div>
      </div>
    );
  }

  // When a label slot is supplied the affordance is rendered there (next to
  // the field label) and stays subtly visible; otherwise it sits beside the value and
  // is only revealed on hover/focus.
  const inLabel = affordanceContainer !== undefined;
  const showEdit = !lock || (canEdit && !lock.locked);

  const affordance = (
    // Keeps its own space and never shrinks. The negative block margin stops
    // the icon buttons from making a single-line row taller than its text.
    <span className="-my-1.5 inline-flex shrink-0 items-center">
      {lock && (
        <LockAffordance
          locked={lock.locked}
          onClick={lock.onToggle}
          title={lock.locked ? lock.lockedTitle : lock.unlockedTitle}
          description={
            lock.locked ? lock.lockedDescription : lock.unlockedDescription
          }
        />
      )}
      {showEdit && (
        <EditAffordance
          className={cn(
            "inline-edit-action",
            inLabel &&
              "group-focus-within/field:opacity-100 group-hover/field:opacity-100",
          )}
          onClick={startEdit}
          ariaLabel={ariaLabel}
          disabled={!canEdit}
          disabledTooltip={disabledTooltip}
          revealOnHover={!inLabel}
        />
      )}
    </span>
  );

  return (
    <div
      className={cn(
        "flex max-w-full items-center gap-1",
        // Beside the value the edit affordance is revealed on hover/focus for
        // a cleaner default view; in the label it is always visible.
        !inLabel &&
          "[&:focus-within_.inline-edit-action]:opacity-100 [&:hover_.inline-edit-action]:opacity-100",
      )}
    >
      {/* The value shrinks and wraps (it can be a long unbroken string such as
          a storage path) so it never overflows the container. */}
      <div className="min-w-0 wrap-anywhere">
        {display ?? <PlaceholderText text={placeholder} />}
      </div>
      {inLabel
        ? affordanceContainer && createPortal(affordance, affordanceContainer)
        : affordance}
    </div>
  );
}
