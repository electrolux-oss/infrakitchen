import React, { Dispatch } from "react";

import { Launch } from "@mui/icons-material";
import { Box, Link, Typography } from "@mui/material";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";

import { useConfig } from "../..";
import StatusChip from "../../StatusChip";

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
            {" "}
            {item.templateName && (
              <>
                <Typography
                  sx={{
                    color: "text.secondary",
                    fontSize: "0.8125rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.templateName}
                </Typography>
                <Typography sx={{ color: "text.secondary" }}>/</Typography>
              </>
            )}
            <Typography
              sx={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.name}
            </Typography>
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
        {...others}
      />
    );
  };

  const getTreeItems = (node: TreeResponse) => {
    const id = node.nodeId;
    allNodeIds.push(id);
    return (
      <StyledTreeItem key={id} nodeId={id} entity_id={node.id} item={node}>
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
