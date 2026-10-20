import {
  ReactNode,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { useNavigate } from "react-router";

import {
  Divider,
  Button,
  Tooltip,
  Card,
  CardContent,
  CardHeader,
  CardActions,
} from "../../../ui";
import { Label } from "../../../ui/Label";
import { PermissionWrapper } from "../../wrappers";
import { PlaceholderDescription } from "../fields/PlaceholderDescription";
import { Labels } from "../labels/Labels";

export interface EntityCardProps {
  name: string;
  entity_name: string;
  description: string;
  detailsUrl: string;
  createUrl?: string;
  onCreateClick?: () => void;
  labels: string[];
  /** Maximum number of labels shown before collapsing into a "+N" chip. */
  labelsMax?: number;
  createButtonName?: string | undefined;
  entityFields: ReactNode;
  status?: string;
  icon?: ReactNode;
  chip?: string;
  chipColor?:
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "warning"
    | "info"
    | "success";
  lastUpdated?: string | Date;
  headerAction?: ReactNode;
  secondaryAction?: ReactNode;
}

export const EntityCard = ({
  name,
  description,
  detailsUrl,
  createUrl,
  onCreateClick,
  labels,
  labelsMax,
  createButtonName,
  entityFields,
  entity_name,
  icon,
  chip,
  chipColor = "info",
  lastUpdated,
  headerAction,
  secondaryAction,
}: EntityCardProps) => {
  const navigate = useNavigate();
  const handleCreateClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (onCreateClick) {
      onCreateClick();
    } else if (createUrl) {
      navigate(createUrl);
    }
  };

  const cardRef = useRef<HTMLDivElement>(null);

  const handleCardClick = () => {
    // Don't navigate when the user is selecting/copying text on the card.
    const selection = window.getSelection();
    if (
      selection &&
      selection.anchorNode &&
      cardRef.current?.contains(selection.anchorNode) &&
      selection.toString().trim().length > 0
    ) {
      return;
    }
    navigate(detailsUrl);
  };

  const handleCardKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(detailsUrl);
    }
  }; // Show "Updated" chip if lastUpdated is within the last 7 days
  const daysSinceUpdate = lastUpdated
    ? Math.floor(
        (new Date().getTime() - new Date(lastUpdated).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : Infinity;
  const isRecentlyUpdated = daysSinceUpdate <= 7;

  // Detect when the description is clamped to two lines so a tooltip with the
  // full text can be shown only when something is actually hidden.
  const descriptionRef = useRef<HTMLElement | null>(null);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);

  // Same deal for the title: a tooltip with the full name is shown only when
  // the single-line no-wrap clamp actually truncates it.
  const titleRef = useRef<HTMLElement | null>(null);
  const [isTitleTruncated, setIsTitleTruncated] = useState(false);

  useEffect(() => {
    const el = descriptionRef.current;
    if (!el) return;
    const check = () => {
      setIsDescriptionTruncated(el.scrollHeight > el.clientHeight + 1);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    document.fonts?.ready.then(check);
    return () => observer.disconnect();
  }, [description]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => {
      setIsTitleTruncated(el.scrollWidth > el.clientWidth + 1);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    document.fonts?.ready.then(check);
    return () => observer.disconnect();
  }, [name]);
  return (
    <Card
      // The card is a CSS grid item; without this, the grid applies a
      // content-based automatic minimum and a long title can inflate the
      // whole row's track width instead of shrinking to it.
      className="relative flex h-full min-w-0 cursor-pointer flex-col gap-2.5 overflow-visible outline-none [transition:transform_150ms_ease-in-out,_box-shadow_150ms_ease-in-out,_border-color_150ms_ease-in-out] hover:-translate-y-0.5 hover:border-fg-disabled hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] focus-visible:shadow-[0_0_0_2px]"
      ref={cardRef}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
    >
      {isRecentlyUpdated && (
        <Label
          tone="success"
          label="Updated"
          className="absolute -top-3 left-4 z-1"
        />
      )}
      <CardHeader
        className="mb-0"
        title={
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <Tooltip title={isTitleTruncated ? name : ""} arrow>
              <span className="min-w-0 flex-1 truncate" ref={titleRef}>
                {name}
              </span>
            </Tooltip>
          </div>
        }
        subheader={
          <Tooltip
            title={isDescriptionTruncated ? description || "" : ""}
            arrow
          >
            <span
              ref={descriptionRef}
              // Reserve two description lines (2 x body2 line-height 1.43) so
              // every card header (and the divider below it) has the same
              // height regardless of how many lines the description renders.
              className="line-clamp-2 min-h-[2.86em] text-body2"
            >
              {description ? description : <PlaceholderDescription />}
            </span>
          </Tooltip>
        }
        action={
          <div
            className="flex items-center gap-1"
            onClick={(e: ReactMouseEvent) => e.stopPropagation()}
          >
            {" "}
            {chip && <Label tone={chipColor} label={chip.toUpperCase()} />}
            {headerAction}
          </div>
        }
      />
      <CardContent className="grow pb-3">
        <Divider className="mb-3" />
        <div className="flex justify-between text-[14px]">{entityFields}</div>
        {labels.length > 0 && (
          <div className="mt-3">
            <Labels labels={labels} max={labelsMax} margins={false} />
          </div>
        )}
      </CardContent>
      <CardActions className="flex-col gap-3 px-2 pt-0">
        <div
          // Reserve the action row even when there is no create button (e.g.
          // disabled templates, or users without write permission) so cards
          // keep a uniform footprint next to their neighbors. Button height
          // is 36px (small), so equal to a present button.
          className="flex min-h-9 w-full justify-center gap-2"
        >
          {createButtonName && (
            <PermissionWrapper
              requiredPermission={`api:${entity_name}`}
              permissionAction="write"
            >
              <Button
                className="flex-1"
                variant="contained"
                onClick={handleCreateClick}
              >
                {createButtonName}
              </Button>
            </PermissionWrapper>
          )}
        </div>{" "}
        {secondaryAction ? (
          <div className="w-full">{secondaryAction}</div>
        ) : null}
      </CardActions>
    </Card>
  );
};
