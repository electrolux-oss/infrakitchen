import { FC, useMemo, useState } from "react";

import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import { Box, Chip, Typography, useColorScheme } from "@mui/material";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import CodeMirror from "@uiw/react-codemirror";

import { HclCodeViewer } from "../../common/components/viewers/HclCodeViewer";

interface CodeSnapshotTabProps {
  codeSnapshot: string | null | undefined;
  defaultRef?: string;
}

interface ParsedFile {
  filename: string;
  content: string;
  ref?: string;
}

interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  file?: ParsedFile;
}

const FILE_DIVIDER_PATTERN = /^#\s*-{2,}\s*FILE:\s*(.+?)\s*-{2,}\s*$/;
const REF_PATTERN = /@([^/]+)$/;

const displayRef = (ref: string) => (ref === "HEAD" ? "Latest" : ref);

function parseCodeSnapshot(
  snapshot: string | null | undefined,
  defaultRef?: string,
): ParsedFile[] {
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
      const filename = match[1].trim();
      const refMatch = filename.match(REF_PATTERN);
      currentFile = {
        filename,
        content: "",
        ref: refMatch ? refMatch[1] : defaultRef,
      };
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

/** Build a nested folder/file tree from flat, "/"-separated file paths. */
function buildTree(files: ParsedFile[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: [] };

  for (const file of files) {
    const parts = file.filename.split("/").filter(Boolean);
    let node = root;
    let acc = "";

    parts.forEach((part, idx) => {
      acc = acc ? `${acc}/${part}` : part;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: acc, children: [] };
        node.children.push(child);
      }
      node = child;
      if (idx === parts.length - 1) node.file = file;
    });
  }

  return root;
}

/** Folders first, then files; alphabetical within each group. */
function sortNodes(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    const aIsFolder = a.children.length > 0;
    const bIsFolder = b.children.length > 0;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function collectFolderPaths(node: TreeNode, acc: string[] = []): string[] {
  for (const child of node.children) {
    if (child.children.length > 0) {
      acc.push(child.path);
      collectFolderPaths(child, acc);
    }
  }
  return acc;
}

function renderTreeItems(nodes: TreeNode[]) {
  return sortNodes(nodes).map((node) => {
    const isFolder = node.children.length > 0;
    return (
      <TreeItem
        key={node.path}
        itemId={node.path}
        label={
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              py: 0.25,
              width: "100%",
              pr: 1,
            }}
          >
            {isFolder ? (
              <FolderOutlinedIcon fontSize="small" color="action" />
            ) : (
              <DescriptionOutlinedIcon fontSize="small" color="action" />
            )}
            <Typography
              variant="body2"
              sx={{ fontFamily: "'Roboto Mono', monospace", fontSize: 13 }}
            >
              {isFolder ? node.name : node.name.replace(/@[^/]+$/, "")}
            </Typography>
            {!isFolder && node.file?.ref && (
              <Chip
                label={displayRef(node.file.ref)}
                size="small"
                variant="outlined"
                sx={{
                  ml: "auto",
                  height: 18,
                  fontSize: 11,
                  fontFamily: "'Roboto Mono', monospace",
                  "& .MuiChip-label": { px: 0.75 },
                }}
              />
            )}
          </Box>
        }
      >
        {isFolder ? renderTreeItems(node.children) : null}
      </TreeItem>
    );
  });
}

function renderFileViewer(file: ParsedFile, colorMode: "light" | "dark") {
  if (file.filename.endsWith(".tf")) {
    return <HclCodeViewer value={file.content} />;
  }

  return (
    <CodeMirror
      value={file.content}
      theme={colorMode}
      readOnly
      editable={false}
      basicSetup={{ foldGutter: true, lineNumbers: true }}
    />
  );
}

export const CodeSnapshotTab: FC<CodeSnapshotTabProps> = ({
  codeSnapshot,
  defaultRef,
}) => {
  const { mode, systemMode } = useColorScheme();
  const resolvedMode = mode === "system" ? systemMode : mode;
  const colorMode: "light" | "dark" =
    resolvedMode === "dark" ? "dark" : "light";

  const files = useMemo(
    () => parseCodeSnapshot(codeSnapshot, defaultRef),
    [codeSnapshot, defaultRef],
  );
  const tree = useMemo(() => buildTree(files), [files]);

  const filesByPath = useMemo(() => {
    const map = new Map<string, ParsedFile>();
    for (const file of files) map.set(file.filename, file);
    return map;
  }, [files]);

  const [selected, setSelected] = useState<string | null>(
    files[0]?.filename ?? null,
  );

  const defaultExpanded = useMemo(() => collectFolderPaths(tree), [tree]);

  if (files.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        No code files found in snapshot.
      </Typography>
    );
  }

  const selectedFile = selected ? filesByPath.get(selected) : undefined;

  return (
    <Box
      sx={{
        display: "flex",
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        minHeight: 400,
      }}
    >
      <Box
        sx={{
          width: 300,
          flexShrink: 0,
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.default",
          overflow: "auto",
          py: 0.5,
        }}
      >
        <SimpleTreeView
          defaultExpandedItems={defaultExpanded}
          selectedItems={selected}
          onSelectedItemsChange={(_e, itemId) => {
            // Only switch the editor when a file (leaf) is selected.
            if (itemId && filesByPath.has(itemId)) setSelected(itemId);
          }}
        >
          {renderTreeItems(tree.children)}
        </SimpleTreeView>
      </Box>

      <Box
        sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
      >
        {selectedFile ? (
          <>
            <Box
              sx={{
                px: 1.5,
                py: 1,
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: "background.default",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{ fontFamily: "'Roboto Mono', monospace" }}
              >
                {selectedFile.filename.replace(/@[^/]+$/, "")}
              </Typography>
              {selectedFile.ref && (
                <Chip
                  label={displayRef(selectedFile.ref)}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: "'Roboto Mono', monospace" }}
                />
              )}
            </Box>
            <Box sx={{ flex: 1, overflow: "auto" }}>
              {renderFileViewer(selectedFile, colorMode)}
            </Box>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            Select a file to view its contents.
          </Typography>
        )}
      </Box>
    </Box>
  );
};
