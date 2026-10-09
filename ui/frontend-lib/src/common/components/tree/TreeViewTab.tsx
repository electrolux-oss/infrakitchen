import { useEffect, useState } from "react";

import { Box } from "@mui/material";

import { useConfig } from "../../context";

import { fetchEntityTree } from "./fetchEntityTree";
import { DEFAULT_TREE_DEPTH, TreeDepthSelect } from "./TreeDepthSelect";
import { EntityTreeViewItems } from "./TreeViewItems";
import { TreeResponse } from "./types";

const getAllNodeIds = (node: TreeResponse): string[] => [
  node.nodeId,
  ...(node.children?.flatMap(getAllNodeIds) ?? []),
];

export interface TreeViewProps {
  entity_name: string;
  entity_id: string;
}

export const EntityTreeViewTab = ({
  entity_id,
  entity_name,
}: TreeViewProps) => {
  const { ikApi } = useConfig();

  const [treeExpanded, setTreeExpanded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tree, setTree] = useState<TreeResponse>();
  const [depth, setDepth] = useState<number>(DEFAULT_TREE_DEPTH);

  useEffect(() => {
    fetchEntityTree(ikApi, entity_name, entity_id, "children", depth).then(
      (tree) => {
        setTree(tree);
        setSelected([tree.nodeId]);
        setTreeExpanded(getAllNodeIds(tree));
      },
    );
  }, [entity_id, entity_name, ikApi, depth]);

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: 480,
        textAlign: "left",
        alignSelf: "flex-start",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "var(--template-surface-radius)",
        backgroundColor: "background.paper",
        overflow: "hidden",
      }}
    >
      <TreeDepthSelect
        value={depth}
        onChange={setDepth}
        sx={{ px: 1.5, pt: 1.5 }}
      />
      {tree && (
        <EntityTreeViewItems
          entity_name={entity_name}
          tree={tree}
          setExpanded={setTreeExpanded}
          setSelected={setSelected}
          selected={selected}
          expanded={treeExpanded}
        />
      )}
    </Box>
  );
};
