import { useParams } from "react-router";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { EntityProvider } from "../../common/context/EntityContext";

export const UserActivityPage = () => {
  const { user_id } = useParams();

  return (
    <EntityProvider entity_name="user" entity_id={user_id || ""}>
      <ActivityContainer tabs={["audit"]} />
    </EntityProvider>
  );
};

UserActivityPage.path = "/users/:user_id/activity";
