import { useState } from "react";

import { Button } from "@mui/material";

import { useConfig, useEntityProvider } from "../../context";
import { buildEntityActionMutation } from "../../graphql/entityActionMutation";
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
    if (entity.id && entity.entityName) {
      setLoading(true);
      const mutation = buildEntityActionMutation(entity.entityName);
      ikApi
        .graphqlRequest<{
          [key: string]: { id: string; status: string; entityName: string };
        }>(mutation, { id: entity.id, input: { action } })
        .then((response) => {
          const result = Object.values(response)[0];
          const entityType =
            (result.entityName || "Resource").charAt(0).toUpperCase() +
            (result.entityName || "Resource").slice(1);
          notify(`${entityType} ${action} task sent successfully`, "success");
          if (refreshEntity) {
            refreshEntity({
              ...entity,
              ...result,
              entityName: entity.entityName,
            });
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
        (entity.entityName || "Resource").charAt(0).toUpperCase() +
        (entity.entityName || "Resource").slice(1);
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
