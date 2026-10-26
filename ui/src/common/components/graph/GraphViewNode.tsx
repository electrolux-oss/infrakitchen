import { useConfig } from "../..";
import { HeroArrowTopRightOnSquareIcon } from "../../../icons";
import { Link } from "../../../ui";
import { cn } from "../../../utils/cn";
import { Entity } from "../entities/Entity";
import { StatusLabel } from "../labels";
import { TreeResponse } from "../tree/types";

/** Every node has this size, so links and fitting never measure the DOM. */
export const GRAPH_NODE_WIDTH = 280;
export const GRAPH_NODE_HEIGHT = 64;

export interface GraphNodeData {
  entity_name: string;
  entity_id: string;
  item: TreeResponse;
  isRoot: boolean;
  /** This node is the hovered or pinned one, or its neighbour. */
  highlighted?: boolean;
  /**
   * Show the full card. Off while zoomed out or off screen, where a plain
   * box is enough and keeps big graphs fast.
   */
  detail?: boolean;
}

/**
 * Graph node for the resource/template dependency graph. The full card
 * mirrors the Tree View's node content so both views stay consistent.
 */
export function GraphViewNode({ data }: { data: GraphNodeData }) {
  const { item, isRoot, highlighted, detail } = data;
  const emphasised = isRoot || highlighted;

  return (
    <div
      className={cn(
        "box-border flex cursor-grab items-center gap-2 overflow-hidden rounded-surface border bg-paper px-3 active:cursor-grabbing",
        emphasised
          ? "border-info shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-info)_20%,transparent)]"
          : "border-divider shadow-[0_1px_2px_rgb(0_0_0/0.1)]",
      )}
      style={{ width: GRAPH_NODE_WIDTH, height: GRAPH_NODE_HEIGHT }}
    >
      {detail ? (
        <NodeDetail data={data} />
      ) : (
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-body2 font-medium text-fg">
            {item.name}
          </div>
          {item.templateName && (
            <div className="truncate text-caption text-fg-muted">
              {item.templateName}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NodeDetail({ data }: { data: GraphNodeData }) {
  const { linkPrefix } = useConfig();
  const { entity_name, entity_id, item } = data;
  const status = String(item.status || "").toLowerCase();
  const state = String(item.state || "").toLowerCase();

  return (
    <>
      <div className="flex min-w-0 flex-auto overflow-hidden">
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
          stacked
          noWrap
          linkClassName="min-w-0 text-body2"
        />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <StatusLabel
          status={status}
          state={state}
          compact
          className="text-[15px]"
        />
        <Link
          href={`${linkPrefix}${entity_name}s/${entity_id}`}
          target="_blank"
          className="inline-flex"
          aria-label={`Open ${item.name} ${entity_name} in new tab`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <HeroArrowTopRightOnSquareIcon className="text-[15px] text-fg-muted" />
        </Link>
      </div>
    </>
  );
}
