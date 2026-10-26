export const UNREAD_DOT_CLASSES = "h-2 w-2 shrink-0 rounded-full bg-error";

/** "approval_required" -> "Approval required" */
export const humanizeNotificationValue = (value?: string | null) => {
  if (!value) return "";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};
