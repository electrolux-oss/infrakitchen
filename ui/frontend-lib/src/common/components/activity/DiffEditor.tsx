import DiffViewer from "react-diff-viewer-continued";

import { Box, useColorScheme, useTheme } from "@mui/material";

export interface DiffEditorProps {
  originalText: string;
  modifiedText: string;
}

export function DiffEditor(props: DiffEditorProps) {
  const { originalText, modifiedText } = props;
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
        key={`diffviewer-${mode}`}
        oldValue={originalText}
        newValue={modifiedText}
        splitView={false}
        hideLineNumbers={false}
        showDiffOnly={false}
        styles={diffStyles}
        useDarkTheme={mode === "dark"}
      />
    </Box>
  );
}
