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

    // Tinted from the theme's status colors, so they follow every theme.
    const tint = (color: string, percent: number) =>
      `color-mix(in srgb, var(${color}) ${percent}%, transparent)`;
    const diffTheme = EditorView.theme({
      "&.cm-merge-a .cm-changedLine, .cm-deletedChunk": {
        backgroundColor: tint("--ik-error", 8),
      },
      "&.cm-merge-b .cm-changedLine, .cm-inlineChangedLine": {
        backgroundColor: tint("--ik-success", 8),
      },
      "&.cm-merge-a .cm-changedText, .cm-deletedChunk .cm-deletedText, &.cm-merge-b .cm-deletedText":
        {
          background: tint("--ik-error", 20),
          textDecoration: "none",
        },
      "&.cm-merge-b .cm-changedText": {
        background: tint("--ik-success", 20),
        textDecoration: "none",
      },
    });

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
      diffTheme,
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
