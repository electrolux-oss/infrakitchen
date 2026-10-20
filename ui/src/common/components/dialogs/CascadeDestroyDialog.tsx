import React, { useEffect, useState } from "react";

import {
  HeroArrowTopRightOnSquareIcon,
  HeroExclamationTriangleIcon,
} from "../../../icons";
import {
  GqlResourceTreeNode,
  RESOURCE_TREE_QUERY,
} from "../../../resources/graphql";
import { Alert, Spinner, Button, IconButton, Tooltip } from "../../../ui";
import { cn } from "../../../utils/cn";
import { useConfig } from "../../context";
import { getStateColor, paletteBgClass } from "../../utils";
import { ConfirmNameField } from "../fields/ConfirmNameField";
import { StatusLabel } from "../labels";

import { CommonDialog } from "./CommonDialog";

interface CascadeDestroyDialogProps {
  open: boolean;
  onClose: () => void;
  entityId: string;
  entityName: string;
  onConfirm: () => void;
  loading: boolean;
}

function flattenTree(node: GqlResourceTreeNode): GqlResourceTreeNode[] {
  return [node, ...(node.children ?? []).flatMap(flattenTree)];
}

const ResourceRow = ({
  resource,
  depth,
}: {
  resource: GqlResourceTreeNode;
  depth: number;
}) => {
  const { linkPrefix } = useConfig();
  const colors = getStateColor(resource.status, resource.state);

  return (
    <div
      className="flex items-center gap-3 rounded-surface px-2 py-1.5 hover:bg-hover"
      style={{ paddingLeft: (1 + depth * 2) * 8 }}
    >
      <Tooltip title={resource.status} arrow>
        <span
          className={cn(
            "block h-2 w-2 shrink-0 rounded-full",
            paletteBgClass(colors.borderColor),
          )}
        />
      </Tooltip>
      {/* name + template */}
      <div className="min-w-0 flex-1">
        <p className="m-0 overflow-hidden text-body2 leading-[1.2] font-medium text-ellipsis whitespace-nowrap">
          {resource.name}
        </p>
        {resource.templateName && (
          <span className="text-caption leading-[1.2] text-fg-muted">
            {resource.templateName}
          </span>
        )}
      </div>
      <StatusLabel status={resource.status} state={resource.state} compact />
      <Tooltip title="Open in new tab" arrow>
        <IconButton
          className="shrink-0 text-fg-muted"
          size="small"
          href={`${linkPrefix}resources/${resource.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${resource.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <HeroArrowTopRightOnSquareIcon className="text-[14px]" />
        </IconButton>
      </Tooltip>
    </div>
  );
};

function renderTreeRows(
  node: GqlResourceTreeNode,
  depth = 0,
): React.ReactElement[] {
  return [
    <ResourceRow key={node.id} resource={node} depth={depth} />,
    ...(node.children ?? []).flatMap((child) =>
      renderTreeRows(child, depth + 1),
    ),
  ];
}

export const CascadeDestroyDialog = ({
  open,
  onClose,
  entityId,
  entityName,
  onConfirm,
  loading,
}: CascadeDestroyDialogProps) => {
  const { ikApi } = useConfig();
  const [confirmValue, setConfirmValue] = useState("");
  const [tree, setTree] = useState<GqlResourceTreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmValue("");
      setTree(null);
      return;
    }
    setTreeLoading(true);
    ikApi
      .graphqlRequest<{ resourceTree: GqlResourceTreeNode | null }>(
        RESOURCE_TREE_QUERY,
        { id: entityId, direction: "children" },
      )
      .then((response) =>
        setTree(response.resourceTree ? response.resourceTree : null),
      )
      .catch(() => setTree(null))
      .finally(() => setTreeLoading(false));
  }, [open, entityId, ikApi]);

  const allResources = tree ? flattenTree(tree) : [];
  const confirmed = confirmValue === entityName;

  return (
    <CommonDialog
      maxWidth="sm"
      open={open}
      onClose={onClose}
      title="Confirmation"
      content={
        <div className="flex flex-col gap-4">
          <Alert severity="error" icon={<HeroExclamationTriangleIcon />}>
            This will permanently destroy <strong>{entityName}</strong> and
            every resource that depends on it. This cannot be undone.
          </Alert>

          <div>
            <h6 className="m-0 mb-1 text-subtitle2 text-grey-500">
              {treeLoading
                ? "Loading affected resources…"
                : `${allResources.length} resource${allResources.length === 1 ? "" : "s"} will be destroyed`}
            </h6>

            <div className="max-h-65 overflow-hidden overflow-y-auto rounded-surface border border-divider">
              {treeLoading ? (
                <div className="flex items-center justify-center gap-3 py-6">
                  <Spinner size={16} />
                  <p className="m-0 text-body2 text-fg-muted">
                    Fetching dependency tree…
                  </p>
                </div>
              ) : tree ? (
                renderTreeRows(tree)
              ) : (
                <p className="m-0 p-4 text-body2 text-fg-muted">
                  Could not load resource tree.
                </p>
              )}
            </div>
          </div>

          <ConfirmNameField
            name={entityName}
            value={confirmValue}
            onChange={setConfirmValue}
          />
        </div>
      }
      actions={
        <Button
          variant="contained"
          color="error"
          disabled={loading || !confirmed}
          onClick={onConfirm}
        >
          {loading ? "Destroying…" : "Cascade Destroy"}
        </Button>
      }
    />
  );
};
