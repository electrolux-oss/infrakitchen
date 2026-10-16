/**
 * Copy via a temporary textarea and `document.execCommand("copy")`. Works
 * where the async Clipboard API is missing or denied: plain-HTTP origins and
 * iframes/webviews embedded without the `clipboard-write` permission.
 */
const copyWithTextarea = (text: string): boolean => {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  // Stay inside an open dialog so its focus trap does not steal the selection.
  const host =
    previouslyFocused?.closest<HTMLElement>('[role="dialog"]') ?? document.body;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  host.appendChild(textarea);

  try {
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    previouslyFocused?.focus?.();
  }
};

/**
 * Writes `text` to the clipboard. Uses the async Clipboard API when it is
 * available and falls back to a textarea copy otherwise; throws when both
 * fail so callers can tell the user instead of failing silently.
 */
export const copyToClipboard = async (text: string): Promise<void> => {
  let cause: unknown;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      cause = error;
    }
  }

  if (copyWithTextarea(text)) return;

  const reason = cause instanceof Error ? `: ${cause.message}` : "";
  throw new Error(`Could not copy to clipboard${reason}`);
};
