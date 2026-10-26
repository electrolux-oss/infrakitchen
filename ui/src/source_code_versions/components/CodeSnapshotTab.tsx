import { FC, useMemo, useState } from "react";

import { json } from "@codemirror/lang-json";
import CodeMirror from "@uiw/react-codemirror";

import { HclCodeViewer } from "../../common/components/viewers/HclCodeViewer";
import {
  HeroDocumentTextIcon,
  HeroFolderIcon,
  HeroFolderOpenIcon,
} from "../../icons";
import { TreeItem, TreeView, useColorScheme } from "../../ui";
import { Label } from "../../ui/Label";

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
        label={({ expanded }) => (
          <div className="flex w-full items-center gap-1.5 py-0.5 pr-2">
            {isFolder ? (
              expanded ? (
                <HeroFolderOpenIcon className="size-4" color="action" />
              ) : (
                <HeroFolderIcon className="size-4" color="action" />
              )
            ) : (
              <HeroDocumentTextIcon className="size-4" color="action" />
            )}
            <p className="m-0 font-mono text-[13px] font-normal">
              {isFolder ? node.name : node.name.replace(/@[^/]+$/, "")}
            </p>
            {!isFolder && node.file?.ref && (
              <Label
                size="small"
                className="ml-auto"
                label={displayRef(node.file.ref)}
              />
            )}
          </div>
        )}
      >
        {isFolder ? renderTreeItems(node.children) : null}
      </TreeItem>
    );
  });
}

function renderFileViewer(file: ParsedFile, colorMode: "light" | "dark") {
  const filename = file.filename.replace(/@[^/]+$/, "");
  if (filename.endsWith(".tf") || filename.endsWith(".hcl")) {
    return <HclCodeViewer value={file.content} />;
  }

  return (
    <CodeMirror
      value={file.content}
      style={{ fontSize: "0.75rem" }}
      theme={colorMode}
      extensions={filename.endsWith(".json") ? [json()] : []}
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
  const { resolvedMode: colorMode } = useColorScheme();

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
      <p className="m-0 p-4 text-body2 text-fg-muted">
        No code files found in snapshot.
      </p>
    );
  }

  const selectedFile = selected ? filesByPath.get(selected) : undefined;

  return (
    <div className="flex min-h-100 overflow-hidden rounded-surface border border-divider">
      <div className="w-75 shrink-0 overflow-auto border-r border-divider bg-canvas py-1">
        <TreeView
          aria-label="Files"
          defaultExpandedItems={defaultExpanded}
          selectedItems={selected}
          onSelectedItemsChange={(_e, itemId) => {
            // Only switch the editor when a file (leaf) is selected.
            if (itemId && filesByPath.has(itemId)) setSelected(itemId);
          }}
        >
          {renderTreeItems(tree.children)}
        </TreeView>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {selectedFile ? (
          <>
            <div className="flex items-center gap-2 border-b border-divider bg-canvas px-3 py-2">
              <h6 className="m-0 font-mono text-caption font-normal text-grey-500">
                {selectedFile.filename.replace(/@[^/]+$/, "")}
              </h6>
              {selectedFile.ref && (
                <Label size="small" label={displayRef(selectedFile.ref)} />
              )}
            </div>
            <div className="flex-1 overflow-auto">
              {renderFileViewer(selectedFile, colorMode)}
            </div>
          </>
        ) : (
          <p className="m-0 p-4 text-body2 text-fg-muted">
            Select a file to view its contents.
          </p>
        )}
      </div>
    </div>
  );
};
