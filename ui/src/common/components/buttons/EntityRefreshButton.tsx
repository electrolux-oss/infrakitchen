import { HeroArrowPathIcon } from "../../../icons";
import { IconButton, Tooltip } from "../../../ui";
import { useEntityProvider } from "../../context/EntityContext";

export const EntityRefreshButton = () => {
  const { refreshEntity } = useEntityProvider();

  return (
    <Tooltip title="Refresh">
      <IconButton
        size="small"
        onClick={() => refreshEntity?.()}
        aria-label="refresh"
      >
        <HeroArrowPathIcon />
      </IconButton>
    </Tooltip>
  );
};
