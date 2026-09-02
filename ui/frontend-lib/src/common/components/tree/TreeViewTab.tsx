import { useEffect, useState } from "react";

import { Box } from "@mui/material";

import { useConfig } from "../../context";

import { fetchEntityTree } from "./fetchEntityTree";
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

  useEffect(() => {
    fetchEntityTree(ikApi, entity_name, entity_id, "children").then((tree) => {
      setTree(tree);
      setSelected([tree.nodeId]);
      setTreeExpanded(getAllNodeIds(tree));
    });
  }, [entity_id, entity_name, ikApi]);

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: 320,
        textAlign: "left",
        alignSelf: "flex-start",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "var(--template-surface-radius)",
        backgroundColor: "background.paper",
        overflow: "hidden",
      }}
    >
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
