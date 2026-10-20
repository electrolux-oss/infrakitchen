import { useNavigate } from "react-router";

import { useConfig } from "../../common";
import { useEntityProvider } from "../../common/context/EntityContext";
import { HeroDocumentDuplicateIcon } from "../../icons";
import { ListItemIcon, ListItemText, MenuItem } from "../../ui";
import { GqlResource } from "../graphql";

interface CloneResourceButtonProps {
  /** Called before navigating, e.g. to close the parent menu */
  onSelect?: () => void;
}

/** "Clone" item for the resource More menu: opens the create page prefilled with this resource. */
export const CloneResourceButton = ({ onSelect }: CloneResourceButtonProps) => {
  const { entity } = useEntityProvider();
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  if (!entity) return null;

  return (
    <MenuItem
      onClick={() => {
        onSelect?.();
        navigate(`${linkPrefix}resources/create`, {
          state: { clone: entity as GqlResource },
        });
      }}
    >
      <ListItemIcon>
        <HeroDocumentDuplicateIcon />
      </ListItemIcon>
      <ListItemText>Clone</ListItemText>
    </MenuItem>
  );
};
