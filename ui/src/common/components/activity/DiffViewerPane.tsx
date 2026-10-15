import { useEffect, useRef } from "react";

import { json } from "@codemirror/lang-json";
import { MergeView, unifiedMergeView } from "@codemirror/merge";
import { EditorView, getDefaultExtensions } from "@uiw/react-codemirror";

import { useColorScheme } from "../../../ui";

import { DIFF_VIEWER_FONT_SIZE, DiffEditorProps } from "./DiffEditor";

const fontTheme = EditorView.theme({
  "&": { fontSize: DIFF_VIEWER_FONT_SIZE },
});

const collapseUnchanged = { margin: 3, minSize: 4 };

/** The CodeMirror merge half of DiffEditor, loaded on demand. */
export default function DiffViewerPane({
  originalText,
  modifiedText,
  splitView = false,
  showDiffOnly = false,
  highlightChanges = true,
}: DiffEditorProps) {
  const { resolvedMode } = useColorScheme();
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const extensions = [
      ...getDefaultExtensions({
        theme: resolvedMode,
        readOnly: true,
        editable: false,
        indentWithTab: false,
        basicSetup: {
          foldGutter: false,
          highlightActiveLine: false,
          highlightActiveLineGutter: false,
        },
      }),
      json(),
      fontTheme,
    ];
    const collapse = showDiffOnly ? collapseUnchanged : undefined;

    const view = splitView
      ? new MergeView({
          a: { doc: originalText, extensions },
          b: { doc: modifiedText, extensions },
          parent,
          highlightChanges,
          collapseUnchanged: collapse,
        })
      : new EditorView({
          doc: modifiedText,
          extensions: [
            ...extensions,
            unifiedMergeView({
              original: originalText,
              mergeControls: false,
              highlightChanges,
              collapseUnchanged: collapse,
            }),
          ],
          parent,
        });

    return () => view.destroy();
  }, [
    originalText,
    modifiedText,
    splitView,
    showDiffOnly,
    highlightChanges,
    resolvedMode,
  ]);

  return <div ref={parentRef} />;
}
