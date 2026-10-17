import React, { Dispatch } from "react";

import { useConfig } from "../..";
import { LaunchIcon } from "../../../icons/material";
import { Link, TreeItem, TreeView } from "../../../ui";
import StatusChip from "../../StatusChip";
import { Entity } from "../entities/Entity";

import { TreeResponse } from "./types";

export interface TreeViewItemProps {
  entity_name: string;
  tree: TreeResponse;
  setExpanded: Dispatch<React.SetStateAction<string[]>>;
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
        <div className="flex min-w-0 items-center gap-3">
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
            linkClassName="min-w-0"
          />
          <StatusChip
            status={status}
            state={state}
            compact
            className="text-[15px]"
          />
          <Link
            className="inline-flex"
            href={`${linkPrefix}${entity_name}s/${entity_id}`}
            target="_blank"
            aria-label={`Open ${item.name} ${entity_name} in new tab`}
          >
            <LaunchIcon className="text-[15px] text-fg-muted" />
          </Link>
        </div>
      }
    >
      {children}
    </TreeItem>
  );
};

export function EntityTreeViewItems(props: TreeViewItemProps) {
  const { entity_name, tree, expanded, setExpanded } = props;
  const { linkPrefix } = useConfig();

  const handleToggle = (
    _event: React.SyntheticEvent | null,
    itemIds: string[],
  ) => {
    setExpanded(itemIds);
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
    <div className="px-3 pt-2 pb-1.5">
      <TreeView
        aria-label={`${entity_name} dependency tree`}
        expandedItems={expanded}
        onExpandedItemsChange={handleToggle}
      >
        {getTreeItems(tree)}
      </TreeView>
    </div>
  );
}
