import { useParams } from "react-router";

import PageContainer from "../../common/PageContainer";
import { RoleContent } from "../components/RoleContent";

export const RolePage = () => {
  const { role_id } = useParams();

  return (
    <PageContainer title={role_id || "Role"}>
      <RoleContent role={role_id} />
    </PageContainer>
  );
};

RolePage.path = "/roles/:role_id";
