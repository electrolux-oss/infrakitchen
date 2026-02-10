import { useEffect, useState } from "react";

import { useConfig, useLocalStorage } from "../../context";
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

  const { value } = useLocalStorage<{
    expanded?: Record<string, boolean>;
  }>();

  const expandedMap = value.expanded ?? {};
  const isExpanded = expandedMap[`${entity_name}-tree-view`];

  useEffect(() => {
    if (!isExpanded) return;
    ikApi.getTree(`${entity_name}s`, entity_id, "children").then((tree) => {
      setTree(tree);
      setSelected([tree.node_id]);
    });
  }, [entity_id, entity_name, ikApi, isExpanded]);

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
