import React, { Dispatch } from "react";

import { Launch } from "@mui/icons-material";
import { Box, Link } from "@mui/material";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";

import { useConfig } from "../..";
import StatusChip from "../../StatusChip";
import { Entity } from "../entities/Entity";

import { TreeResponse } from "./types";

export interface TreeViewItemProps {
  entity_name: string;
  tree: TreeResponse;
  setExpanded: Dispatch<React.SetStateAction<string[]>>;
  setSelected: Dispatch<React.SetStateAction<string[]>>;
  selected: string[];
  expanded: string[];
}

interface StyledTreeItemProps {
  nodeId: string;
  entity_id: string;
  item: TreeResponse;
  entity_name: string;
  linkPrefix: string;
  children?: React.ReactNode;
}

// Defined outside EntityTreeViewItems so its component identity stays stable
// across renders; otherwise every render would create a new component type,
// forcing React to unmount/remount the whole tree (very slow for large trees).
const StyledTreeItem = ({
  nodeId,
  entity_id,
  item,
  entity_name,
  linkPrefix,
  children,
}: StyledTreeItemProps) => {
  const status = String(item.status || "").toLowerCase();
  const state = String(item.state || "").toLowerCase();

  return (
    <TreeItem
      itemId={nodeId}
      label={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            minWidth: 0,
          }}
        >
          <Entity
            entity={{
              id: entity_id,
              name: item.name,
              entityName: entity_name,
              template: item.templateName
                ? { name: item.templateName }
                : undefined,
            }}
            showLabel
            noWrap
            sx={{ minWidth: 0 }}
          />
          <StatusChip
            status={status}
            state={state}
            compact
            sx={{ fontSize: 15 }}
          />
          <Link
            href={`${linkPrefix}${entity_name}s/${entity_id}`}
            target="_blank"
            sx={{ display: "inline-flex" }}
            aria-label={`Open ${item.name} ${entity_name} in new tab`}
          >
            <Launch sx={{ fontSize: 15, color: "text.secondary" }} />
          </Link>
        </Box>
      }
      sx={{
        "& .MuiTreeItem-content": {
          borderRadius: 1,
          py: 0.25,
          "&[data-selected], &[data-focused], &[data-selected][data-focused]":
            {
              backgroundColor: "transparent",
              "&:hover": {
                backgroundColor: "transparent",
              },
            },
        },
      }}
    >
      {children}
    </TreeItem>
  );
};

export function EntityTreeViewItems(props: TreeViewItemProps) {
  const { entity_name, tree, selected, expanded, setExpanded, setSelected } =
    props;
  const { linkPrefix } = useConfig();

  const handleToggle = (
    _event: React.SyntheticEvent | null,
    itemIds: string[],
  ) => {
    setExpanded(itemIds);
  };

  const handleSelect = (
    _event: React.SyntheticEvent | null,
    itemIds: string[],
  ) => {
    setSelected(itemIds);
  };

  const getTreeItems = (node: TreeResponse) => {
    const id = node.nodeId;
    return (
      <StyledTreeItem
        key={id}
        nodeId={id}
        entity_id={node.id}
        item={node}
        entity_name={entity_name}
        linkPrefix={linkPrefix}
      >
        {node.children?.map((child: TreeResponse) => getTreeItems(child))}
      </StyledTreeItem>
    );
  };

  return (
    <Box sx={{ px: 1.5, pt: 4, pb: 0.75 }}>
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
