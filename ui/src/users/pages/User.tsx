import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { UserAvatar } from "../../common/components/entities/UserAvatar";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { Label } from "../../ui";
import { UserContent } from "../components/UserContent";
import { USER_FIELDS } from "../graphql";

const UserTitleAvatar = () => {
  const { entity } = useEntityProvider();
  if (!entity?.identifier) return entityIcons.user;
  return (
    <UserAvatar
      identifier={entity.identifier}
      className="size-8 cursor-default text-base"
    />
  );
};

const DeactivatedBadge = () => {
  const { entity } = useEntityProvider();
  return entity?.deactivated ? (
    <Label label="Deactivated" tone="error" size="large" />
  ) : null;
};

export const UserPage = () => {
  const { user_id } = useParams();

  return (
    <EntityProvider
      entity_name="user"
      entity_id={user_id || ""}
      entityFields={USER_FIELDS}
    >
      <EntityContainer
        titleIcon={<UserTitleAvatar />}
        titleAdornment={<DeactivatedBadge />}
      >
        <UserContent />
      </EntityContainer>
    </EntityProvider>
  );
};

UserPage.path = "/users/:user_id/:tab?";
