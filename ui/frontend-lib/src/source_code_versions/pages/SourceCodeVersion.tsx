import { useParams } from "react-router";

import { LogLiveTail } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { SourceCodeVersionContent } from "../components/SourceCodeVersionContent";
import { SCV_DETAIL_FIELDS } from "../graphql";

export const SourceCodeVersionPage = () => {
  const { source_code_version_id } = useParams();

  return (
    <EntityProvider
      entity_name="sourceCodeVersion"
      entity_id={source_code_version_id || ""}
      entityFields={SCV_DETAIL_FIELDS}
    >
      <EntityContainer title={"Template Version Overview"}>
        <SourceCodeVersionContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

SourceCodeVersionPage.path = "/source_code_versions/:source_code_version_id";
