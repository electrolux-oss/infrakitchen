import { useParams } from "react-router";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { EntityProvider } from "../../common/context/EntityContext";

export const SourceCodeActivityPage = () => {
  const { source_code_id } = useParams();

  return (
    <EntityProvider entity_name="source_code" entity_id={source_code_id || ""}>
      <ActivityContainer tabs={["audit", "revisions"]} />
    </EntityProvider>
  );
};

SourceCodeActivityPage.path = "/source_codes/:source_code_id/activity";
