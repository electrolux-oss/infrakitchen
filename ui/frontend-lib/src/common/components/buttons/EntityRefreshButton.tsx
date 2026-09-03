import RefreshIcon from "@mui/icons-material/Refresh";
import { IconButton, Tooltip } from "@mui/material";

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
        <RefreshIcon />
      </IconButton>
    </Tooltip>
  );
};
