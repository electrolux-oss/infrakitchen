import { useNavigate } from "react-router";

import { PermissionWrapper, useConfig } from "../../common";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Button, Tooltip } from "../../ui";
import { GqlExecutor } from "../graphql/transforms";

export const CloneExecutorButton = () => {
  const { entity } = useEntityProvider();
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  if (!entity) return null;

  return (
    <PermissionWrapper
      requiredPermission="api:executor"
      permissionAction="write"
    >
      <Tooltip title="Create a new executor prefilled with these values">
        <Button
          onClick={() =>
            navigate(`${linkPrefix}executors/create`, {
              state: { clone: entity as GqlExecutor },
            })
          }
        >
          Clone
        </Button>
      </Tooltip>
    </PermissionWrapper>
  );
};
