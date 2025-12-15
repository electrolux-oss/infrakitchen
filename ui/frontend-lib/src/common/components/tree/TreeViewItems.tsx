import React, { Dispatch } from "react";

import { Launch } from "@mui/icons-material";
import { Box, Button, Link, Typography } from "@mui/material";
import Tooltip from "@mui/material/Tooltip";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";

import { useConfig } from "../..";
import { getStateColor } from "../../utils";

import { TreeResponse } from "./types";

export interface TreeViewItemProps {
  entity_name: string;
  tree: TreeResponse;
  setExpanded: Dispatch<React.SetStateAction<string[]>>;
  setSelected: Dispatch<React.SetStateAction<string[]>>;
  selected: string[];
  expanded: string[];
}

export function EntityTreeViewItems(props: TreeViewItemProps) {
  const { entity_name, tree, selected, expanded, setExpanded, setSelected } =
    props;
  const { linkPrefix } = useConfig();
  const allNodeIds: string[] = [];

  const handleToggle = (
    _event: React.SyntheticEvent | null,
    itemIds: string[],
  ) => {
    setExpanded(itemIds);
  };

  const handleExpandClick = () => {
    setExpanded((oldExpanded: string[]) =>
      oldExpanded.length === 0 ? allNodeIds : [],
    );
  };

  const handleSelect = (
    _event: React.SyntheticEvent | null,
    itemIds: string[],
  ) => {
    setSelected(itemIds);
  };

  const StyledTreeItem = (style_props: any) => {
    const { nodeId, entity_id, item, ...others } = style_props;

    const status = String(item.status || "").toLowerCase();
    const state = String(item.state || "").toLowerCase();
    const stateValue = state ? `${state} [${status}]` : status;

    return (
      <TreeItem
        itemId={nodeId}
        label={
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: "bold",
              }}
            >
              {item.template_name && `${item.template_name}: ${item.name}`}
              {!item.template_name && `${item.name}`}
            </Typography>
            <Tooltip title={stateValue} arrow>
              <Box
                sx={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  boxShadow: "none",
                  verticalAlign: "middle",
                  backgroundColor: getStateColor(status, state).borderColor,
                }}
              />
            </Tooltip>
            <Link
              href={`${linkPrefix}${entity_name}s/${entity_id}`}
              target="_blank"
              sx={{ display: "inline-flex" }}
              aria-label={`Open ${item.name} ${entity_name} in new tab`}
            >
              <Launch sx={{ fontSize: 18 }} />
            </Link>
          </Box>
        }
        {...others}
      />
    );
  };

  const getTreeItems = (node: TreeResponse) => {
    const id = node.node_id;
    allNodeIds.push(id);
    return (
      <StyledTreeItem key={id} nodeId={id} entity_id={node.id} item={node}>
        {node.children?.map((child: TreeResponse) => getTreeItems(child))}
      </StyledTreeItem>
    );
  };

  return (
    <Box>
      <Box display="flex" justifyContent="flex-end">
        <Button onClick={handleExpandClick}>
          {expanded.length === 0 ? "Expand all" : "Collapse all"}
        </Button>
      </Box>
      <SimpleTreeView
        expandedItems={expanded}
        selectedItems={selected}
        onExpandedItemsChange={handleToggle}
        onSelectedItemsChange={handleSelect}
        multiSelect
      >
        {getTreeItems(tree)}
      </SimpleTreeView>
    </Box>
  );
}
