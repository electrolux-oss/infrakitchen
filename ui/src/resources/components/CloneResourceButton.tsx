import { useNavigate } from "react-router";

import { PermissionWrapper, useConfig } from "../../common";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Button, Tooltip } from "../../ui";
import { GqlResource } from "../graphql";

export const CloneResourceButton = () => {
  const { entity } = useEntityProvider();
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  if (!entity) return null;

  return (
    <PermissionWrapper
      requiredPermission="api:resource"
      permissionAction="write"
    >
      <Tooltip title="Create a new resource prefilled with these values">
        <Button
          onClick={() =>
            navigate(`${linkPrefix}resources/create`, {
              state: { clone: entity as GqlResource },
            })
          }
        >
          Clone
        </Button>
      </Tooltip>
    </PermissionWrapper>
  );
};
