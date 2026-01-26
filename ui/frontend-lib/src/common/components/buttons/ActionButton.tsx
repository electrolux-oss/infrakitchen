import { Button } from "@mui/material";

import { useConfig, useEntityProvider } from "../../context";
import { notify, notifyError } from "../../hooks/useNotification";

export const ActionButton = (props: {
  action: string;
  onSubmit: () => void;
  disabled?: boolean;
  color?: "success" | "error";
  variant?: "contained" | "outlined";
  children: string;
}) => {
  const {
    action,
    children,
    color,
    variant,
    disabled,
    onSubmit: onClose,
  } = props;

  const { ikApi } = useConfig();
  const { entity, refreshEntity } = useEntityProvider();

  const handleClick = () => {
    if (entity.id || entity._entity_name) {
      ikApi
        .patchRaw(`${entity._entity_name}s/${entity.id}/actions`, {
          action: action,
        })
        .then(() => {
          const entityType =
            (entity._entity_name || "Resource").charAt(0).toUpperCase() +
            (entity._entity_name || "Resource").slice(1);
          notify(`${entityType} ${action} task sent successfully`, "success");
          if (refreshEntity) {
            refreshEntity();
          }
        })
        .catch((error) => {
          notifyError(error);
        })
        .finally(() => {
          onClose();
        });
    } else {
      const entityType =
        (entity._entity_name || "Resource").charAt(0).toUpperCase() +
        (entity._entity_name || "Resource").slice(1);
      notifyError(new Error(`${entityType} ${action} error: no record id`));
    }
  };

  return (
    <Button
      color={color || "success"}
      onClick={() => handleClick()}
      variant={variant || "outlined"}
      disabled={disabled}
      aria-label="Action Button"
    >
      {children}
    </Button>
  );
};
