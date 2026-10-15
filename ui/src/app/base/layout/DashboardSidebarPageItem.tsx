import * as React from "react";

import { Link } from "react-router";

import DashboardSidebarContext from "../../context/DashboardSidebarContext";

import { SIDEBAR_ITEM_CLASS, SIDEBAR_ITEM_SELECTED_CLASS } from "./mixins";

import { MINI_DRAWER_WIDTH } from "@/constants";
import {
  cn,
  Collapse,
  ExpandMoreIcon,
  Label,
  ListItemIcon,
  ListItemText,
  Tooltip,
  usePermissionProvider,
} from "@/index";

export interface DashboardSidebarPageItemProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  /** Page URL; omit for pure group parents that only expand/collapse. */
  href?: string;
  action?: React.ReactNode;
  /** Small pill shown next to the title, e.g. "alpha" or "beta". */
  label?: string;
  defaultExpanded?: boolean;
  expanded?: boolean;
  selected?: boolean;
  disabled?: boolean;
  nestedNavigation?: React.ReactNode;
  permissionKey?: string;
}

export default function DashboardSidebarPageItem({
  id,
  title,
  icon,
  href,
  action,
  label,
  defaultExpanded = false,
  expanded = defaultExpanded,
  selected = false,
  disabled = false,
  nestedNavigation,
  permissionKey,
}: DashboardSidebarPageItemProps) {
  const sidebarContext = React.useContext(DashboardSidebarContext);
  if (!sidebarContext) {
    throw new Error("Sidebar context was used without a provider.");
  }
  const {
    onPageItemClick,
    mini = false,
    fullyExpanded = true,
    fullyCollapsed = false,
  } = sidebarContext;

  const [isHovered, setIsHovered] = React.useState(false);
  const [flyoutTop, setFlyoutTop] = React.useState<number>();
  const flyoutPaperRef = React.useRef<HTMLDivElement>(null);
  const permissions = usePermissionProvider().permissions;

  // Align the flyout with the hovered item; shift it up if the submenu would
  // overflow the bottom of the viewport.
  React.useEffect(() => {
    if (isHovered && flyoutTop !== undefined && flyoutPaperRef.current) {
      const maxTop =
        window.innerHeight - flyoutPaperRef.current.offsetHeight - 8;
      if (flyoutTop > maxTop) {
        setFlyoutTop(Math.max(8, maxTop));
      }
    }
  }, [isHovered, flyoutTop]);

  const handleMiniMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLLIElement>) => {
      setFlyoutTop(e.currentTarget.getBoundingClientRect().top);
      setIsHovered(true);
    },
    [],
  );

  const handleMiniMouseLeave = React.useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleClick = React.useCallback(() => {
    if (onPageItemClick) {
      onPageItemClick(id, !!nestedNavigation);
    }
  }, [onPageItemClick, id, nestedNavigation]);

  let expandIconClass = "hidden";
  if (mini && fullyCollapsed) {
    expandIconClass =
      "absolute top-[41.5%] right-0.5 size-[18px]! -translate-y-1/2 -rotate-90";
  } else if (!mini && fullyExpanded) {
    expandIconClass = cn(
      "ml-1 size-5! shrink-0 transition-transform duration-100 ease-[cubic-bezier(0.4,0,0.6,1)]",
      !expanded && "-rotate-90",
    );
  }

  const hasExternalHref = href
    ? href.startsWith("http://") || href.startsWith("https://")
    : false;

  const miniNestedNavigationSidebarContextValue = React.useMemo(() => {
    return {
      onPageItemClick: onPageItemClick ?? (() => {}),
      mini: false,
      fullyExpanded: true,
      fullyCollapsed: false,
      hasDrawerTransitions: false,
    };
  }, [onPageItemClick]);

  if (
    permissionKey &&
    !permissions[`api:${permissionKey}`] &&
    !permissions["*"]
  ) {
    return null;
  }

  const itemClassName = cn(
    SIDEBAR_ITEM_CLASS,
    mini && "h-[34px]",
    selected && SIDEBAR_ITEM_SELECTED_CLASS,
    disabled && "pointer-events-none opacity-40",
  );

  // In mini mode a group parent only reveals its children on hover; it
  // neither navigates nor toggles.
  const navigates = Boolean(href) && !(nestedNavigation && mini);
  const clickable = !(nestedNavigation && mini);

  const content = (
    <>
      {icon || mini ? (
        <div
          className={cn(
            mini &&
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          )}
        >
          <ListItemIcon
            className={cn("mr-0 flex items-center", mini && "justify-center")}
          >
            {icon}
          </ListItemIcon>
        </div>
      ) : null}
      {!mini ? (
        <ListItemText className="z-1 whitespace-nowrap" primary={title} />
      ) : null}
      {label && !mini ? (
        <Label className="ml-2 shrink-0" label={label} />
      ) : null}
      {action && !mini && fullyExpanded ? action : null}
      {nestedNavigation ? <ExpandMoreIcon className={expandIconClass} /> : null}
    </>
  );

  const button = navigates ? (
    hasExternalHref ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={itemClassName}
        aria-current={selected ? "page" : undefined}
        onClick={handleClick}
      >
        {content}
      </a>
    ) : (
      <Link
        to={href!}
        className={itemClassName}
        aria-current={selected ? "page" : undefined}
        onClick={handleClick}
      >
        {content}
      </Link>
    )
  ) : (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={nestedNavigation ? expanded : undefined}
      aria-label={nestedNavigation && mini ? title : undefined}
      className={itemClassName}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={(event) => {
        if (clickable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          handleClick();
        }
      }}
    >
      {content}
    </div>
  );

  return (
    <React.Fragment>
      <li
        className="block overflow-x-hidden"
        {...(nestedNavigation && mini
          ? {
              onMouseEnter: handleMiniMouseEnter,
              onMouseLeave: handleMiniMouseLeave,
            }
          : {})}
      >
        <Tooltip
          title={mini && !nestedNavigation ? title : ""}
          placement="right"
        >
          {button}
        </Tooltip>
        {nestedNavigation && mini && isHovered ? (
          <div
            className="fixed z-[1300] pl-1.5 transition-[opacity,scale] duration-200 ease-out starting:scale-75 starting:opacity-0"
            style={{ left: MINI_DRAWER_WIDTH - 2, top: flyoutTop }}
          >
            <div
              ref={flyoutPaperRef}
              className="rounded-surface bg-paper py-[1.6px] text-fg shadow-dropdown"
            >
              <p className="m-0 px-4 py-2 text-body2 font-medium whitespace-nowrap text-fg-muted">
                {title}
              </p>
              <ul className="m-0 list-none p-0">
                <DashboardSidebarContext.Provider
                  value={miniNestedNavigationSidebarContextValue}
                >
                  {nestedNavigation}
                </DashboardSidebarContext.Provider>
              </ul>
            </div>
          </div>
        ) : null}
      </li>
      {nestedNavigation && !mini ? (
        <Collapse in={expanded} unmountOnExit>
          {nestedNavigation}
        </Collapse>
      ) : null}
    </React.Fragment>
  );
}
