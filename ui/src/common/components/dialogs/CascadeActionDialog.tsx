import React, { useEffect, useState } from "react";

import {
  HeroArrowTopRightOnSquareIcon,
  HeroExclamationTriangleIcon,
  HeroInformationCircleIcon,
} from "../../../icons";
import {
  GqlResourceCascadeNode,
  GqlResourceTreeNode,
  RESOURCE_CASCADE_PREVIEW_QUERY,
  RESOURCE_TREE_QUERY,
} from "../../../resources/graphql";
import {
  Alert,
  Spinner,
  Button,
  Checkbox,
  IconButton,
  Label,
  Tooltip,
} from "../../../ui";
import { cn } from "../../../utils/cn";
import { useConfig } from "../../context";
import { getStateColor, paletteBgClass } from "../../utils";
import { ConfirmNameField } from "../fields/ConfirmNameField";
import { StatusLabel } from "../labels";

import { CommonDialog } from "./CommonDialog";

export type CascadeMode = "destroy" | "plan" | "apply" | "blueprint";

const MODE_TEXT: Record<
  CascadeMode,
  { verb: string; button: string; busy: string }
> = {
  destroy: {
    verb: "destroyed",
    button: "Cascade Destroy",
    busy: "Destroying…",
  },
  plan: { verb: "planned", button: "Cascade Plan", busy: "Creating…" },
  apply: { verb: "applied", button: "Cascade Apply", busy: "Creating…" },
  blueprint: {
    verb: "included",
    button: "Create Blueprint",
    busy: "Opening…",
  },
};

/** Modes that ask the server which resources will run. */
const PREVIEW_MODES: CascadeMode[] = ["plan", "apply"];

interface CascadeActionDialogProps {
  mode: CascadeMode;
  open: boolean;
  onClose: () => void;
  entityId: string;
  entityName: string;
  /**
   * Receives the resources the user deselected (always empty for destroy) and
   * the templates of the selected resources, parents first.
   */
  onConfirm: (excludeIds: string[], templateIds: string[]) => void;
  loading: boolean;
}

const DESELECTED = "deselected";

function flattenTree(node: GqlResourceTreeNode): GqlResourceTreeNode[] {
  return [node, ...(node.children ?? []).flatMap(flattenTree)];
}

/** Unique templates of the selected resources, in tree (parent-first) order. */
function selectedTemplateIds(
  tree: GqlResourceTreeNode | null,
  excluded: Set<string>,
): string[] {
  if (!tree) return [];
  const ids = flattenTree(tree)
    .filter((node) => !excluded.has(node.id))
    .map((node) => node.templateId);
  return [...new Set(ids)];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface RowSelection {
  skipped: Map<string, string | null>;
  /** Undefined for destroy, which always covers the whole tree. */
  onToggle?: (resourceId: string, selected: boolean) => void;
}

const ResourceRow = ({
  resource,
  depth,
  selection,
}: {
  resource: GqlResourceTreeNode;
  depth: number;
  selection: RowSelection;
}) => {
  const { linkPrefix } = useConfig();
  const colors = getStateColor(resource.status, resource.state);
  const skipReason = selection.skipped.get(resource.id);
  const deselected = skipReason === DESELECTED;
  // Only resources the cascade would run, or that the user deselected, can be toggled
  const selectable = skipReason === undefined || deselected;

  return (
    <div
      className="flex items-center gap-3 rounded-surface px-2 py-1.5 hover:bg-hover"
      style={{ paddingLeft: (1 + depth * 2) * 8 }}
    >
      {selection.onToggle && (
        <Checkbox
          size="small"
          className="m-0 shrink-0"
          checked={skipReason === undefined}
          disabled={!selectable}
          aria-label={`Include ${resource.name}`}
          onChange={(event) =>
            selection.onToggle?.(resource.id, event.target.checked)
          }
        />
      )}
      <Tooltip title={resource.status} arrow>
        <span
          className={cn(
            "block h-2 w-2 shrink-0 rounded-full",
            paletteBgClass(colors.borderColor),
          )}
        />
      </Tooltip>
      {/* name + template */}
      <div className={cn("min-w-0 flex-1", skipReason && "opacity-60")}>
        <p className="m-0 overflow-hidden text-body2 leading-[1.2] font-medium text-ellipsis whitespace-nowrap">
          {resource.name}
        </p>
        {resource.templateName && (
          <span className="text-caption leading-[1.2] text-fg-muted">
            {resource.templateName}
          </span>
        )}
      </div>
      {skipReason && !deselected && (
        <Tooltip title="This resource will be skipped" arrow>
          <Label size="small" tone="warning" label={`Skipped: ${skipReason}`} />
        </Tooltip>
      )}
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
  selection: RowSelection,
  depth = 0,
  path = "",
): React.ReactElement[] {
  // A resource with several parents appears once per path
  const key = `${path}/${node.id}`;
  return [
    <ResourceRow
      key={key}
      resource={node}
      depth={depth}
      selection={selection}
    />,
    ...(node.children ?? []).flatMap((child) =>
      renderTreeRows(child, selection, depth + 1, key),
    ),
  ];
}

/**
 * Confirmation dialog for an action on a resource and every resource that
 * depends on it. Plan and apply ask the server which resources will run, so
 * skipped ones are shown with the reason, and let the user deselect
 * resources; the preview is refreshed after every change.
 */
export const CascadeActionDialog = ({
  mode,
  open,
  onClose,
  entityId,
  entityName,
  onConfirm,
  loading,
}: CascadeActionDialogProps) => {
  const { ikApi } = useConfig();
  const [confirmValue, setConfirmValue] = useState("");
  const [tree, setTree] = useState<GqlResourceTreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [preview, setPreview] = useState<GqlResourceCascadeNode[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const excludeIds = [...excluded].sort();
  const excludeKey = excludeIds.join(",");

  useEffect(() => {
    if (!open) {
      setConfirmValue("");
      setTree(null);
      setPreview(null);
      setPreviewError(null);
      setExcluded(new Set());
      return;
    }
    setTreeLoading(true);
    ikApi
      .graphqlRequest<{ resourceTree: GqlResourceTreeNode | null }>(
        RESOURCE_TREE_QUERY,
        { id: entityId, direction: "children" },
      )
      .then((response) => setTree(response.resourceTree ?? null))
      .catch(() => setTree(null))
      .finally(() => setTreeLoading(false));
  }, [open, entityId, ikApi]);

  useEffect(() => {
    if (!open || !PREVIEW_MODES.includes(mode)) return;
    let stale = false;
    setPreviewLoading(true);
    ikApi
      .graphqlRequest<{
        resourceCascadePreview: GqlResourceCascadeNode[];
      }>(RESOURCE_CASCADE_PREVIEW_QUERY, {
        id: entityId,
        action: mode,
        excludeIds: excludeKey ? excludeKey.split(",") : [],
      })
      .then((response) => {
        if (stale) return;
        setPreview(response.resourceCascadePreview);
        setPreviewError(null);
      })
      .catch((error: unknown) => {
        if (stale) return;
        setPreview(null);
        setPreviewError(errorMessage(error));
      })
      .finally(() => {
        if (!stale) setPreviewLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [open, entityId, ikApi, mode, excludeKey]);

  const toggle = (resourceId: string, selected: boolean) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (selected) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });

  const text = MODE_TEXT[mode];
  const skipped = new Map<string, string | null>(
    (preview ?? [])
      .filter((node) => !node.included)
      .map((node) => [node.resourceId, node.reason]),
  );
  // Keep deselections visible while the preview reloads or after it fails
  for (const id of excluded) skipped.set(id, DESELECTED);
  const selection: RowSelection = {
    skipped,
    onToggle: mode === "destroy" ? undefined : toggle,
  };
  const templateIds = selectedTemplateIds(tree, excluded);
  const selectedCount = tree
    ? new Set(
        flattenTree(tree)
          .map((node) => node.id)
          .filter((id) => !excluded.has(id)),
      ).size
    : 0;
  const count =
    mode === "destroy"
      ? (tree ? flattenTree(tree) : []).length
      : mode === "blueprint"
        ? templateIds.length
        : (preview ?? []).filter((node) => node.included).length;

  const canConfirm =
    mode === "destroy"
      ? confirmValue === entityName
      : mode === "blueprint"
        ? !treeLoading && count > 0
        : !treeLoading && !previewLoading && !previewError && count > 0;

  const heading =
    mode === "blueprint"
      ? `${count} template${count === 1 ? "" : "s"} from ${selectedCount} resource${selectedCount === 1 ? "" : "s"} will be ${text.verb}`
      : `${count} resource${count === 1 ? "" : "s"} will be ${text.verb}`;

  return (
    <CommonDialog
      maxWidth="sm"
      resizable
      open={open}
      onClose={onClose}
      title="Confirmation"
      content={
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {mode === "destroy" && (
            <Alert severity="error" icon={<HeroExclamationTriangleIcon />}>
              This will permanently destroy <strong>{entityName}</strong> and
              every resource that depends on it. This cannot be undone.
            </Alert>
          )}
          {mode === "plan" && (
            <Alert severity="info" icon={<HeroInformationCircleIcon />}>
              Plans <strong>{entityName}</strong> and every resource that
              depends on it, parents first. Nothing is changed. Untick resources
              to skip them.
            </Alert>
          )}
          {mode === "apply" && (
            <Alert severity="warning" icon={<HeroExclamationTriangleIcon />}>
              Applies <strong>{entityName}</strong> and every resource that
              depends on it, parents first. Resources waiting for approval are
              skipped. Nothing is approved automatically. Untick resources to
              skip them.
            </Alert>
          )}

          {mode === "blueprint" && (
            <Alert severity="info" icon={<HeroInformationCircleIcon />}>
              Creates a blueprint from the templates of{" "}
              <strong>{entityName}</strong> and the resources that depend on it.
              Resources sharing a template add it once. Untick resources to
              leave their templates out.
            </Alert>
          )}

          {previewError && <Alert severity="error">{previewError}</Alert>}

          <div className="flex min-h-0 flex-1 flex-col">
            <h6 className="m-0 mb-1 text-subtitle2 text-grey-500">
              {treeLoading ? "Loading affected resources…" : heading}
            </h6>

            {/* Capped until the user resizes the dialog (inline height), then fills it */}
            <div className="max-h-65 min-h-20 overflow-hidden overflow-y-auto rounded-surface border border-divider [[style*='height']_&]:max-h-none [[style*='height']_&]:flex-1">
              {treeLoading ? (
                <div className="flex items-center justify-center gap-3 py-6">
                  <Spinner size={16} />
                  <p className="m-0 text-body2 text-fg-muted">
                    Fetching dependency tree…
                  </p>
                </div>
              ) : tree ? (
                renderTreeRows(tree, selection)
              ) : (
                <p className="m-0 p-4 text-body2 text-fg-muted">
                  Could not load resource tree.
                </p>
              )}
            </div>
          </div>

          {mode === "destroy" && (
            <ConfirmNameField
              name={entityName}
              value={confirmValue}
              onChange={setConfirmValue}
            />
          )}
        </div>
      }
      actions={
        <Button
          variant="contained"
          color={mode === "plan" || mode === "blueprint" ? "primary" : "error"}
          disabled={loading || !canConfirm}
          onClick={() =>
            onConfirm(mode === "destroy" ? [] : excludeIds, templateIds)
          }
        >
          {loading ? text.busy : text.button}
        </Button>
      }
    />
  );
};

type ModeDialogProps = Omit<CascadeActionDialogProps, "mode">;

export const CascadeDestroyDialog = (props: ModeDialogProps) => (
  <CascadeActionDialog mode="destroy" {...props} />
);
