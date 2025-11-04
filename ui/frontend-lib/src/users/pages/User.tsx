import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { UserContent } from "../components/UserContent";

export const UserPage = () => {
  const { user_id } = useParams();

  return (
    <EntityProvider entity_name="user" entity_id={user_id || ""}>
      <EntityContainer title={"User Overview"}>
        <UserContent />
      </EntityContainer>
    </EntityProvider>
  );
};

UserPage.path = "/users/:user_id";
