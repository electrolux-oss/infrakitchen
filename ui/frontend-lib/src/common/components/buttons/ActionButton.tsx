import { useState } from "react";

import { Button } from "@mui/material";

import { IkEntity } from "../../../types";
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
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (entity.id || entity._entity_name) {
      setLoading(true);
      ikApi
        .patchRaw(`${entity._entity_name}s/${entity.id}/actions`, {
          action: action,
        })
        .then((response: IkEntity) => {
          const entityType =
            (response._entity_name || "Resource").charAt(0).toUpperCase() +
            (response._entity_name || "Resource").slice(1);
          notify(`${entityType} ${action} task sent successfully`, "success");
          if (refreshEntity) {
            refreshEntity(response);
          }
          onClose();
        })
        .catch((error) => {
          notifyError(error);
        })
        .finally(() => {
          setLoading(false);
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
      disabled={disabled || loading}
      aria-label="Action Button"
    >
      {children}
      {loading && " ..."}
    </Button>
  );
};
