import { Button } from "@mui/material";

import { InfraKitchenApi } from "../../../api";
import { notify, notifyError } from "../../hooks/useNotification";

export const DeleteButton = (props: {
  entity_name: string;
  entity_id: string;
  ikApi: InfraKitchenApi;
  onClose?: () => void;
  onDelete?: () => void;
  children?: string;
}) => {
  const { entity_id, entity_name, ikApi, onClose, onDelete, children } = props;

  const handleClick = () => {
    if (entity_id) {
      ikApi
        .deleteRaw(`${entity_name}s/${entity_id}`, {})
        .then(() => {
          notify(
            `${entity_name.charAt(0).toUpperCase() + entity_name.slice(1)} delete completed successfully`,
            "success",
          );
          if (onDelete) onDelete();
        })
        .catch((error) => {
          notifyError(error);
        })
        .finally(() => {
          if (onClose) onClose();
        });
    } else {
      notifyError(new Error(`Resource delete error: no record id`));
    }
  };

  return (
    <Button color="error" variant="contained" onClick={handleClick}>
      {children}
    </Button>
  );
};
