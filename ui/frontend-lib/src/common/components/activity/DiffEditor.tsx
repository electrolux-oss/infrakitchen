import DiffViewer, { DiffMethod } from "react-diff-viewer-continued";

import { Box, useColorScheme, useTheme } from "@mui/material";

export interface DiffEditorProps {
  originalText: string;
  modifiedText: string;
  /** Side-by-side (true) vs unified (false) view. Defaults to unified. */
  splitView?: boolean;
  /** Whether to hide unchanged lines. Defaults to showing full context. */
  showDiffOnly?: boolean;
}

export function DiffEditor(props: DiffEditorProps) {
  const {
    originalText,
    modifiedText,
    splitView = false,
    showDiffOnly = false,
  } = props;
  const theme = useTheme();
  const { mode } = useColorScheme();

  const diffStyles = {
    variables: {
      dark: {
        diffViewerBackground: theme.vars?.palette.grey?.[800],
        gutterBackground: theme.vars?.palette.background.paper,
        gutterColor: theme.vars?.palette.text.secondary,
      },
    },
    marker: {
      fontSize: theme.typography.caption.fontSize,
    },
    line: {
      fontSize: theme.typography.caption.fontSize,
      "&:hover": {
        background: theme.palette.action.hover,
      },
    },
    lineNumber: {
      fontSize: theme.typography.caption.fontSize,
    },
  };

  return (
    <Box
      sx={{
        height: "100%",
        overflow: "auto",
      }}
    >
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
    </Box>
  );
}
