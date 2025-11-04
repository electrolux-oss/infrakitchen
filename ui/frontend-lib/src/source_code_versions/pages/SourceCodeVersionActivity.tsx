import { useParams } from "react-router";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { EntityProvider } from "../../common/context/EntityContext";

export const SourceCodeVersionActivityPage = () => {
  const { source_code_version_id } = useParams();

  return (
    <EntityProvider
      entity_name="source_code_version"
      entity_id={source_code_version_id || ""}
    >
      <ActivityContainer tabs={["audit", "logs", "revisions"]} />
    </EntityProvider>
  );
};

SourceCodeVersionActivityPage.path =
  "/source_code_versions/:source_code_version_id/activity";
