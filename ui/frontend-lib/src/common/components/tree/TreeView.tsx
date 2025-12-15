import { useEffect, useState } from "react";

import { useConfig } from "../../context";
import { PropertyCollapseCard } from "../PropertyCollapseCard";

import { EntityTreeViewItems } from "./TreeViewItems";
import { TreeResponse } from "./types";

export interface TreeViewProps {
  entity_name: string;
  entity_id: string;
}

export const EntityTreeView = ({ entity_id, entity_name }: TreeViewProps) => {
  const { ikApi } = useConfig();

  const [treeExpanded, setTreeExpanded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [tree, setTree] = useState<TreeResponse>();

  useEffect(() => {
    ikApi.getTree(`${entity_name}s`, entity_id, "children").then((tree) => {
      setTree(tree);
      setSelected([tree.node_id]);
    });
  }, [entity_id, entity_name, ikApi]);

  return (
    <PropertyCollapseCard
      title="Tree View"
      expanded={true}
      id={`${entity_name}-tree-view`}
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
    </PropertyCollapseCard>
  );
};
