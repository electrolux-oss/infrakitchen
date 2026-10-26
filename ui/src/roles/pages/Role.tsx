import { useParams } from "react-router";

import PageContainer from "../../common/PageContainer";
import { HeroUserGroupIcon } from "../../icons";
import { RoleContent } from "../components/RoleContent";

export const RolePage = () => {
  const { role_id } = useParams();

  return (
    <PageContainer
      documentTitle={role_id}
      title={
        <span className="inline-flex items-center gap-2.5">
          <span className="inline-flex shrink-0 text-fg-muted">
            <HeroUserGroupIcon />
          </span>
          {role_id}
        </span>
      }
    >
      <RoleContent role={role_id} />
    </PageContainer>
  );
};

RolePage.path = "/roles/:role_id/:tab?";
