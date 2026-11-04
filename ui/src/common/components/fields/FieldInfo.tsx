import { HeroInformationCircleIcon } from "../../../icons";
import { Tooltip } from "../../../ui";

/** Info icon with a tooltip, shown next to a field label. */
export const FieldInfo = ({ text }: { text: string }) => (
  <Tooltip title={text}>
    <span
      className="inline-flex text-[15px] text-action-active"
      tabIndex={0}
      aria-label={text}
    >
      <HeroInformationCircleIcon className="block" fontSize="small" />
    </span>
  </Tooltip>
);
