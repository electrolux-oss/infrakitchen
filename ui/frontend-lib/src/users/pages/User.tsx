import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { UserContent } from "../components/UserContent";
import { transformUser, USER_FIELDS } from "../graphql";

export const UserPage = () => {
  const { user_id } = useParams();

  return (
    <EntityProvider
      entity_name="user"
      entity_id={user_id || ""}
      transformFn={transformUser}
      entityFields={USER_FIELDS}
    >
      <EntityContainer title={"User Overview"} hideEditAction>
        <UserContent />
      </EntityContainer>
    </EntityProvider>
  );
};

UserPage.path = "/users/:user_id/:tab?";
