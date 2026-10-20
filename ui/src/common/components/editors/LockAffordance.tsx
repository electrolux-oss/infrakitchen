import { HeroLockClosedIcon, HeroLockOpenIcon } from "../../../icons";
import { IconButton, Tooltip } from "../../../ui";

interface LockAffordanceProps {
  /** Whether the field is currently locked (shows a solid lock) or unlocked. */
  locked: boolean;
  onClick: () => void;
  /** Bold heading shown in the tooltip; also used as the accessible name. */
  title: string;
  /** Supporting line shown under the title with the reason + action. */
  description?: string;
}

/**
 * Inline lock affordance for protected fields. Renders as a persistent icon
 * that communicates the lock state at a glance: a solid lock when locked
 * (click to unlock) and a lock-open icon when unlocked (click to lock).
 */
export const LockAffordance = ({
  locked,
  onClick,
  title,
  description,
}: LockAffordanceProps) => {
  const button = (
    <IconButton
      className="size-5 shrink-0 border border-transparent p-0 hover:border-divider hover:bg-hover"
      size="small"
      onClick={onClick}
      aria-label={description ? `${title}. ${description}` : title}
    >
      {locked ? (
        <HeroLockClosedIcon className="text-[16px]" />
      ) : (
        <HeroLockOpenIcon className="text-[16px]" />
      )}
    </IconButton>
  );

  return (
    <Tooltip
      title={
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{title}</span>
          {description ? (
            <span className="font-normal opacity-85">{description}</span>
          ) : null}
        </div>
      }
    >
      <span>{button}</span>
    </Tooltip>
  );
};
