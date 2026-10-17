import { lazy, Suspense } from "react";

import { Spinner } from "../../../ui";

/** Caption size used for diff lines and gutters. */
export const DIFF_VIEWER_FONT_SIZE = "0.75rem";

// @codemirror/merge and the editor setup load only when a diff is shown.
const DiffViewerPane = lazy(() => import("./DiffViewerPane"));

export interface DiffEditorProps {
  originalText: string;
  modifiedText: string;
  /** Side-by-side (true) vs unified (false) view. Defaults to unified. */
  splitView?: boolean;
  /** Whether to hide unchanged lines. Defaults to showing full context. */
  showDiffOnly?: boolean;
  /** Whether to mark changed words inside changed lines. Defaults to true. */
  highlightChanges?: boolean;
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
