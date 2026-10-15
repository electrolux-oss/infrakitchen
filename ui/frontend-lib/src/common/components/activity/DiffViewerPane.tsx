import DiffViewer, { DiffMethod } from "react-diff-viewer-continued";

import { useColorScheme } from "../../../ui";

import {
  DIFF_VIEWER_DARK_VARIABLES,
  DIFF_VIEWER_FONT_SIZE,
  DiffEditorProps,
} from "./DiffEditor";

const diffStyles = {
  variables: { dark: DIFF_VIEWER_DARK_VARIABLES },
  marker: { fontSize: DIFF_VIEWER_FONT_SIZE },
  line: {
    fontSize: DIFF_VIEWER_FONT_SIZE,
    "&:hover": { background: "var(--color-hover)" },
  },
  lineNumber: { fontSize: DIFF_VIEWER_FONT_SIZE },
};

/** The react-diff-viewer half of DiffEditor, loaded on demand. */
export default function DiffViewerPane({
  originalText,
  modifiedText,
  splitView = false,
  showDiffOnly = false,
}: DiffEditorProps) {
  const { resolvedMode: mode } = useColorScheme();

  return (
    <DiffViewer
      key={`diffviewer-${mode}-${splitView}-${showDiffOnly}`}
      oldValue={originalText}
      newValue={modifiedText}
      splitView={splitView}
      hideLineNumbers={false}
      showDiffOnly={showDiffOnly}
      styles={diffStyles}
      useDarkTheme={mode === "dark"}
      compareMethod={DiffMethod.WORDS}
    />
  );
}
