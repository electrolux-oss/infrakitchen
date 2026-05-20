import { useParams } from "react-router";

import { LogLiveTail } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { SourceCodeVersionContent } from "../components/SourceCodeVersionContent";

export const SourceCodeVersionPage = () => {
  const { source_code_version_id } = useParams();

  return (
    <EntityProvider
      entity_name="source_code_version"
      entity_id={source_code_version_id || ""}
    >
      <EntityContainer title={"Template Version Overview"}>
        <SourceCodeVersionContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

SourceCodeVersionPage.path = "/source_code_versions/:source_code_version_id";
