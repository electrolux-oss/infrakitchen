import { useParams } from "react-router";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { EntityProvider } from "../../common/context/EntityContext";

export const PermissionActivityPage = () => {
  const { permission_id } = useParams();

  return (
    <EntityProvider entity_name="permission" entity_id={permission_id || ""}>
      <ActivityContainer tabs={["audit"]} />
    </EntityProvider>
  );
};

PermissionActivityPage.path = "/permissions/:permission_id/activity";
