import { lazy, Suspense } from "react";

import { Spinner } from "../../../ui";

/** Dark-scheme colours for react-diff-viewer, shared by every diff view. */
export const DIFF_VIEWER_DARK_VARIABLES = {
  diffViewerBackground: "var(--color-grey-800)",
  gutterBackground: "var(--color-paper)",
  gutterColor: "var(--color-fg-muted)",
};

/** Caption size used for diff lines and gutters. */
export const DIFF_VIEWER_FONT_SIZE = "0.75rem";

// react-diff-viewer brings diff, Emotion and more; load it only when shown.
const DiffViewerPane = lazy(() => import("./DiffViewerPane"));

export interface DiffEditorProps {
  originalText: string;
  modifiedText: string;
  /** Side-by-side (true) vs unified (false) view. Defaults to unified. */
  splitView?: boolean;
  /** Whether to hide unchanged lines. Defaults to showing full context. */
  showDiffOnly?: boolean;
}

export function DiffEditor(props: DiffEditorProps) {
  return (
    <div className="h-full overflow-auto">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center p-4">
            <Spinner size={24} />
          </div>
        }
      >
        <DiffViewerPane {...props} />
      </Suspense>
    </div>
  );
}
