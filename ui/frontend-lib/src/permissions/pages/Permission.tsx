import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { PermissionContent } from "../components/PermissionContent";

export const PermissionPage = () => {
  const { permission_id } = useParams();

  return (
    <EntityProvider entity_name="permission" entity_id={permission_id || ""}>
      <EntityContainer title={"Permission Overview"}>
        <PermissionContent />
      </EntityContainer>
    </EntityProvider>
  );
};

PermissionPage.path = "/permissions/:permission_id";
