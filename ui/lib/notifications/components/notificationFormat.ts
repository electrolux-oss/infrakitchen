export const UNREAD_DOT_SX = {
  width: 8,
  height: 8,
  flexShrink: 0,
  borderRadius: "50%",
  bgcolor: "error.main",
} as const;

/** "approval_required" -> "Approval required" */
export const humanizeNotificationValue = (value?: string | null) => {
  if (!value) return "";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};
