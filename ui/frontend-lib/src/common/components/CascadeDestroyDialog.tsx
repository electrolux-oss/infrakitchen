import React, { useEffect, useState } from "react";

import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import LaunchIcon from "@mui/icons-material/Launch";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  GqlResourceTreeNode,
  RESOURCE_TREE_QUERY,
  transformResourceTreeNode,
} from "../../resources/graphql";
import { useConfig } from "../context";
import StatusChip from "../StatusChip";
import { getStateColor } from "../utils";

import { CommonDialog } from "./CommonDialog";
import { ConfirmNameField } from "./ConfirmNameField";
import { TreeResponse } from "./tree/types";

interface CascadeDestroyDialogProps {
  open: boolean;
  onClose: () => void;
  entityId: string;
  entityName: string;
  onConfirm: () => void;
  loading: boolean;
}

function flattenTree(node: TreeResponse): TreeResponse[] {
  return [node, ...(node.children ?? []).flatMap(flattenTree)];
}

const ResourceRow = ({
  resource,
  depth,
}: {
  resource: TreeResponse;
  depth: number;
}) => {
  const { linkPrefix } = useConfig();
  const colors = getStateColor(resource.status, resource.state);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 0.75,
        px: 1,
        pl: 1 + depth * 2,
        borderRadius: 1,
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Tooltip title={resource.status} arrow>
        <Box
          sx={{
            flexShrink: 0,
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: colors.borderColor,
          }}
        />
      </Tooltip>

      {/* name + template */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {resource.name}
        </Typography>
        {resource.templateName && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ lineHeight: 1.2 }}
          >
            {resource.templateName}
          </Typography>
        )}
      </Box>

      <StatusChip status={resource.status} state={resource.state} compact />

      <Tooltip title="Open in new tab" arrow>
        <IconButton
          size="small"
          component="a"
          href={`${linkPrefix}resources/${resource.id}`}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ flexShrink: 0, color: "text.secondary" }}
          aria-label={`Open ${resource.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <LaunchIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

function renderTreeRows(node: TreeResponse, depth = 0): React.ReactElement[] {
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
  const [tree, setTree] = useState<TreeResponse | null>(null);
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
        setTree(
          response.resourceTree
            ? transformResourceTreeNode(response.resourceTree)
            : null,
        ),
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
      title={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DeleteForeverIcon />
          <Typography variant="h6" component="span">
            Cascade Destroy
          </Typography>
        </Box>
      }
      content={
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Alert severity="warning" icon={<WarningAmberIcon />}>
            This will permanently destroy <strong>{entityName}</strong> and
            every resource that depends on it. This cannot be undone.
          </Alert>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {treeLoading
                ? "Loading affected resources…"
                : `${allResources.length} resource${allResources.length === 1 ? "" : "s"} will be destroyed`}
            </Typography>

            <Box
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                overflow: "hidden",
                maxHeight: 260,
                overflowY: "auto",
              }}
            >
              {treeLoading ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1.5,
                    py: 3,
                  }}
                >
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    Fetching dependency tree…
                  </Typography>
                </Box>
              ) : tree ? (
                renderTreeRows(tree)
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2 }}
                >
                  Could not load resource tree.
                </Typography>
              )}
            </Box>
          </Box>

          <ConfirmNameField
            name={entityName}
            value={confirmValue}
            onChange={setConfirmValue}
          />
        </Box>
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
