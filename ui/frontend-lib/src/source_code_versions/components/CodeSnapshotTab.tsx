import { FC, useMemo } from "react";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from "@mui/material";
import CodeMirror from "@uiw/react-codemirror";

import { HclCodeViewer } from "../../common/components/viewers/HclCodeViewer";

interface CodeSnapshotTabProps {
  codeSnapshot: string | null | undefined;
}

interface ParsedFile {
  filename: string;
  content: string;
}

const FILE_DIVIDER_PATTERN = /^#\s*-{2,}\s*FILE:\s*(.+?)\s*-{2,}\s*$/;

function parseCodeSnapshot(snapshot: string | null | undefined): ParsedFile[] {
  if (!snapshot) return [];
  const lines = snapshot.split("\n");
  const files: ParsedFile[] = [];
  let currentFile: ParsedFile | null = null;

  for (const line of lines) {
    const match = line.match(FILE_DIVIDER_PATTERN);
    if (match) {
      if (currentFile) {
        currentFile.content = currentFile.content.trimEnd();
        files.push(currentFile);
      }
      currentFile = { filename: match[1].trim(), content: "" };
    } else if (currentFile) {
      currentFile.content += line + "\n";
    }
  }

  if (currentFile) {
    currentFile.content = currentFile.content.trimEnd();
    files.push(currentFile);
  }

  return files;
}

function renderFileViewer(file: ParsedFile) {
  if (file.filename.endsWith(".tf")) {
    return <HclCodeViewer value={file.content} />;
  }

  return (
    <CodeMirror
      value={file.content}
      readOnly
      editable={false}
      basicSetup={{ foldGutter: true, lineNumbers: true }}
    />
  );
}

export const CodeSnapshotTab: FC<CodeSnapshotTabProps> = ({ codeSnapshot }) => {
  const files = useMemo(() => parseCodeSnapshot(codeSnapshot), [codeSnapshot]);

  if (files.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        No code files found in snapshot.
      </Typography>
    );
  }

  return (
    <Box sx={{ pt: 0.5, display: "flex", flexDirection: "column", gap: 1 }}>
      {files.map((file) => (
        <Accordion key={file.filename} defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography
              variant="subtitle2"
              sx={{ fontFamily: "'Roboto Mono', monospace" }}
            >
              {file.filename}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {renderFileViewer(file)}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};
