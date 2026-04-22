import { useEffect, useState } from "react";

import { Box } from "@mui/material";

import { useConfig } from "../../context";
import { OverviewCard } from "../OverviewCard";

import { EntityTreeViewItems } from "./TreeViewItems";
import { TreeResponse } from "./types";

const getAllNodeIds = (node: TreeResponse): string[] => [
  node.node_id,
  ...(node.children?.flatMap(getAllNodeIds) ?? []),
];

interface TreeViewProps {
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
    ikApi.getTree(`${entity_name}s`, entity_id, "children").then((tree) => {
      setTree(tree);
      setSelected([tree.node_id]);
      setTreeExpanded(getAllNodeIds(tree));
    });
  }, [entity_id, entity_name, ikApi]);

  return (
    <OverviewCard name="Tree View">
      {tree && (
        <Box sx={{ width: "100%", textAlign: "left", alignSelf: "flex-start" }}>
          <EntityTreeViewItems
            entity_name={entity_name}
            tree={tree}
            setExpanded={setTreeExpanded}
            setSelected={setSelected}
            selected={selected}
            expanded={treeExpanded}
          />
        </Box>
      )}
    </OverviewCard>
  );
};
