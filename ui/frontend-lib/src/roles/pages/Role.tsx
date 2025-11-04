import { useNavigate, useParams } from "react-router";

import { useConfig } from "../../common";
import PageContainer from "../../common/PageContainer";
import { RoleContent } from "../components/RoleContent";

export const RolePage = () => {
  const { role_id } = useParams();
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  return (
    <PageContainer
      title={role_id || "Role"}
      onBack={() => navigate(`${linkPrefix}roles`)}
    >
      <RoleContent role={role_id} />
    </PageContainer>
  );
};

RolePage.path = "/roles/:role_id";
