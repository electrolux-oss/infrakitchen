import { useEffect, useState } from "react";

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
  const [tree, setTree] = useState<TreeResponse>();
  const [depth, setDepth] = useState<number>(DEFAULT_TREE_DEPTH);

  useEffect(() => {
    fetchEntityTree(ikApi, entity_name, entity_id, "children", depth).then(
      (tree) => {
        setTree(tree);
        setTreeExpanded(getAllNodeIds(tree));
      },
    );
  }, [entity_id, entity_name, ikApi, depth]);

  return (
    <div className="min-h-120 w-full self-start overflow-hidden rounded-surface border border-divider bg-paper text-left">
      <TreeDepthSelect
        value={depth}
        onChange={setDepth}
        className="px-3 pt-3"
      />
      {tree && (
        <EntityTreeViewItems
          entity_name={entity_name}
          tree={tree}
          setExpanded={setTreeExpanded}
          expanded={treeExpanded}
        />
      )}
    </div>
  );
};
