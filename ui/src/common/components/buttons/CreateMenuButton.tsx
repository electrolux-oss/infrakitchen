import { ReactNode, useState } from "react";

import { useNavigate } from "react-router";

import { HeroChevronDownIcon, HeroPlusCircleIcon } from "../../../icons";
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "../../../ui";
import { useConfig } from "../../context/ConfigContext";
import { usePermissionProvider } from "../../context/PermissionContext";
import { CreatePrefillState } from "../../hooks/useCreatePrefill";

export interface CreateMenuOption {
  /** Name of what gets created, e.g. "Resource". */
  label: string;
  /** Button text when this is the only option; defaults to "Create <label>". */
  buttonLabel?: string;
  icon?: ReactNode;
  /** Create page path, relative to the link prefix. */
  path: string;
  /** Navigation state the create page reads to prefill its form. */
  state?: CreatePrefillState;
  /** Shown only with write access to this permission resource. */
  permission: string;
}

/**
 * Header shortcut for creating entities from the current page. Only options
 * the user can write are kept: one becomes a "Create <label>" button, several
 * are grouped under a "Create" dropdown.
 */
export const CreateMenuButton = ({
  options,
}: {
  options: CreateMenuOption[];
}) => {
  const { linkPrefix } = useConfig();
  const { checkActionPermission } = usePermissionProvider();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const allowed = options.filter((option) =>
    checkActionPermission(option.permission, "write"),
  );
  if (allowed.length === 0) return null;

  const open = (option: CreateMenuOption) => {
    setAnchor(null);
    navigate(`${linkPrefix}${option.path}`, { state: option.state });
  };

  if (allowed.length === 1) {
    const [option] = allowed;
    return (
      <Button startIcon={<HeroPlusCircleIcon />} onClick={() => open(option)}>
        {option.buttonLabel ?? `Create ${option.label}`}
      </Button>
    );
  }

  return (
    <>
      <Button
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        startIcon={<HeroPlusCircleIcon />}
        endIcon={<HeroChevronDownIcon />}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        Create
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {allowed.map((option) => (
          <MenuItem key={option.path} onClick={() => open(option)}>
            {option.icon && <ListItemIcon>{option.icon}</ListItemIcon>}
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
