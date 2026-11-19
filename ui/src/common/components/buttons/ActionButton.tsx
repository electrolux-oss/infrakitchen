import { Button } from "../../../ui";
import { useEntityAction } from "../../hooks/useEntityAction";

export const ActionButton = (props: {
  action: string;
  onSubmit: () => void;
  disabled?: boolean;
  color?: "error";
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

  const { runAction, loading } = useEntityAction();

  const handleClick = async () => {
    if (await runAction(action)) {
      onClose();
    }
  };

  return (
    <Button
      color={color}
      onClick={() => void handleClick()}
      variant={variant || "outlined"}
      disabled={disabled || loading}
      aria-label="Action Button"
    >
      {children}
      {loading && " ..."}
    </Button>
  );
};
