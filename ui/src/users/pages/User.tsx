import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { entityIcons } from "../../common/components/entities/entityIcons";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { Label } from "../../ui";
import { UserContent } from "../components/UserContent";
import { USER_FIELDS } from "../graphql";

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
        titleIcon={entityIcons.user}
        titleAdornment={<DeactivatedBadge />}
      >
        <UserContent />
      </EntityContainer>
    </EntityProvider>
  );
};

UserPage.path = "/users/:user_id/:tab?";
