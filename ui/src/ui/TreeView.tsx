import {
  Children,
  createContext,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  SyntheticEvent,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { HeroChevronDownIcon } from "../icons";
import { cn } from "../utils/cn";

import { Collapse } from "./Collapse";
import { useControllable } from "./useControllable";

type Selection<Multiple> = Multiple extends true ? string[] : string | null;

export interface TreeViewProps<
  Multiple extends boolean | undefined = undefined,
> {
  /** Expanded item ids (controlled). */
  expandedItems?: string[];
  defaultExpandedItems?: string[];
  onExpandedItemsChange?: (event: SyntheticEvent, itemIds: string[]) => void;
  /** Selected id, or ids with `multiSelect` (controlled). */
  selectedItems?: Selection<Multiple>;
  defaultSelectedItems?: Selection<Multiple>;
  onSelectedItemsChange?: (
    event: SyntheticEvent,
    itemIds: Selection<Multiple>,
  ) => void;
  /** Ctrl/Cmd-click adds to the selection. */
  multiSelect?: Multiple;
  className?: string;
  "aria-label"?: string;
  children?: ReactNode;
}

interface TreeContextValue {
  isExpanded: (itemId: string) => boolean;
  isSelected: (itemId: string) => boolean;
  selectable: boolean;
  toggle: (event: SyntheticEvent, itemId: string) => void;
  select: (event: SyntheticEvent, itemId: string) => void;
  focusedId: string | null;
  setFocusedId: (itemId: string) => void;
}

const TreeContext = createContext<TreeContextValue | null>(null);
const LevelContext = createContext(1);

const ITEM_SELECTOR = '[role="treeitem"]';

/** Items not inside a collapsed group, in document order. */
const visibleItems = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (item) => !item.closest("[inert]"),
  );

/**
 * Accessible tree (WAI-ARIA tree pattern). Arrow keys move and expand/collapse, Home/End jump,
 * Enter toggles and selects, Space selects, `*` expands siblings.
 */
export function TreeView<Multiple extends boolean | undefined = undefined>({
  expandedItems,
  defaultExpandedItems = [],
  onExpandedItemsChange,
  selectedItems,
  defaultSelectedItems,
  onSelectedItemsChange,
  multiSelect,
  className,
  "aria-label": ariaLabel,
  children,
}: TreeViewProps<Multiple>) {
  const rootRef = useRef<HTMLUListElement>(null);
  const [expanded, setExpanded] = useControllable(
    expandedItems,
    defaultExpandedItems,
    undefined,
  );
  const emptySelection = (multiSelect ? [] : null) as Selection<Multiple>;
  const [selected, setSelected] = useControllable(
    selectedItems,
    defaultSelectedItems ?? emptySelection,
    undefined,
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const selectedIds: string[] = Array.isArray(selected)
    ? selected
    : selected
      ? [selected as string]
      : [];

  const setExpandedIds = (event: SyntheticEvent, ids: string[]) => {
    setExpanded(ids);
    onExpandedItemsChange?.(event, ids);
  };

  const context: TreeContextValue = {
    isExpanded: (itemId) => expanded.includes(itemId),
    isSelected: (itemId) => selectedIds.includes(itemId),
    selectable:
      selectedItems !== undefined ||
      defaultSelectedItems !== undefined ||
      onSelectedItemsChange !== undefined,
    toggle: (event, itemId) =>
      setExpandedIds(
        event,
        expanded.includes(itemId)
          ? expanded.filter((id) => id !== itemId)
          : [...expanded, itemId],
      ),
    select: (event, itemId) => {
      let next: Selection<Multiple>;
      if (multiSelect) {
        const additive =
          (event as MouseEvent).ctrlKey || (event as MouseEvent).metaKey;
        next = (
          additive
            ? selectedIds.includes(itemId)
              ? selectedIds.filter((id) => id !== itemId)
              : [...selectedIds, itemId]
            : [itemId]
        ) as Selection<Multiple>;
      } else {
        next = itemId as Selection<Multiple>;
      }
      setSelected(next);
      onSelectedItemsChange?.(event, next);
    },
    focusedId,
    setFocusedId,
  };

  // Roving tabindex: keep exactly one visible item tabbable.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const items = visibleItems(root);
    if (items.some((item) => item.dataset.treeId === focusedId)) return;
    const selectedList = ([] as (string | null)[]).concat(selected);
    const fallback =
      items.find((item) => selectedList.includes(item.dataset.treeId!)) ??
      items[0];
    if (fallback) setFocusedId(fallback.dataset.treeId!);
    // Expanding, collapsing or new children change which items are visible.
  }, [focusedId, expanded, selected, children]);

  const handleKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const root = rootRef.current;
    const current = (event.target as HTMLElement).closest<HTMLElement>(
      ITEM_SELECTOR,
    );
    if (!root || !current || event.altKey) return;
    // Keys typed into controls inside a label are theirs.
    if ((event.target as HTMLElement).closest("input, textarea, select"))
      return;
    const items = visibleItems(root);
    const index = items.indexOf(current);
    const itemId = current.dataset.treeId!;
    const hasChildren = current.dataset.hasChildren !== undefined;
    const isOpen = expanded.includes(itemId);
    const focus = (item: HTMLElement | null | undefined) => item?.focus();

    switch (event.key) {
      case "ArrowDown":
        focus(items[index + 1]);
        break;
      case "ArrowUp":
        focus(items[index - 1]);
        break;
      case "Home":
        focus(items[0]);
        break;
      case "End":
        focus(items[items.length - 1]);
        break;
      case "ArrowRight":
        if (!hasChildren) return;
        if (isOpen) focus(items[index + 1]);
        else context.toggle(event, itemId);
        break;
      case "ArrowLeft":
        if (hasChildren && isOpen) context.toggle(event, itemId);
        else focus(current.parentElement?.closest<HTMLElement>(ITEM_SELECTOR));
        break;
      case "Enter":
        if (current.getAttribute("aria-disabled") === "true") return;
        if (hasChildren) context.toggle(event, itemId);
        context.select(event, itemId);
        break;
      case " ":
        if (current.getAttribute("aria-disabled") === "true") return;
        context.select(event, itemId);
        break;
      case "*": {
        const siblings = Array.from(
          current.parentElement?.children ?? [],
        ) as HTMLElement[];
        const ids = siblings
          .filter((item) => item.dataset.hasChildren !== undefined)
          .map((item) => item.dataset.treeId!)
          .filter((id) => !expanded.includes(id));
        if (ids.length) setExpandedIds(event, [...expanded, ...ids]);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <TreeContext.Provider value={context}>
      <ul
        ref={rootRef}
        role="tree"
        aria-label={ariaLabel}
        aria-multiselectable={multiSelect || undefined}
        onKeyDown={handleKeyDown}
        className={cn("m-0 list-none p-0", className)}
      >
        {children}
      </ul>
    </TreeContext.Provider>
  );
}

export interface TreeItemProps {
  itemId: string;
  label: ReactNode | ((state: { expanded: boolean }) => ReactNode);
  disabled?: boolean;
  /** Classes for the item's row. */
  className?: string;
  children?: ReactNode;
}

/** One node of a TreeView; nested TreeItems are its children. */
export function TreeItem({
  itemId,
  label,
  disabled = false,
  className,
  children,
}: TreeItemProps) {
  const tree = useContext(TreeContext);
  const level = useContext(LevelContext);
  if (!tree) throw new Error("TreeItem must be rendered inside a TreeView");

  const hasChildren = Children.toArray(children).length > 0;
  const expanded = hasChildren && tree.isExpanded(itemId);
  const selected = tree.isSelected(itemId);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    // Links and buttons inside the label handle their own clicks.
    if ((event.target as Element).closest("a, button")) return;
    if (disabled) return;
    if (hasChildren) tree.toggle(event, itemId);
    if (tree.selectable) tree.select(event, itemId);
  };

  return (
    <li
      role="treeitem"
      data-tree-id={itemId}
      data-has-children={hasChildren ? "" : undefined}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={tree.selectable ? selected : undefined}
      aria-disabled={disabled || undefined}
      aria-level={level}
      tabIndex={tree.focusedId === itemId ? 0 : -1}
      onFocus={(event) => {
        if (event.target === event.currentTarget) tree.setFocusedId(itemId);
      }}
      className="list-none outline-none [&:focus-visible>div:first-child]:outline-2 [&:focus-visible>div:first-child]:-outline-offset-2 [&:focus-visible>div:first-child]:outline-primary"
    >
      <div
        onClick={handleClick}
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-[4px] px-1 py-0.5 text-body2 text-fg",
          selected ? "bg-primary/8 hover:bg-primary/12" : "hover:bg-hover",
          disabled && "cursor-default opacity-50",
          className,
        )}
      >
        <span className="flex size-6 shrink-0 items-center justify-center text-fg-muted">
          {hasChildren && (
            <HeroChevronDownIcon
              className={cn(
                "size-4 transition-transform duration-150",
                !expanded && "-rotate-90",
              )}
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {typeof label === "function" ? label({ expanded }) : label}
        </div>
      </div>
      {hasChildren && (
        <Collapse in={expanded} inert={!expanded}>
          <ul role="group" className="m-0 list-none p-0 pl-4">
            <LevelContext.Provider value={level + 1}>
              {children}
            </LevelContext.Provider>
          </ul>
        </Collapse>
      )}
    </li>
  );
}
