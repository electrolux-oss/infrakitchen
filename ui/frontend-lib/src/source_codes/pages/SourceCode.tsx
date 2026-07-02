import { useParams } from "react-router";

import { LogLiveTail } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { SourceCodeContent } from "../components/SourceCodeContent";
import { SOURCE_CODE_DETAIL_FIELDS } from "../graphql";

export const SourceCodePage = () => {
  const { source_code_id } = useParams();

  return (
    <EntityProvider
      entity_name="sourceCode"
      entity_id={source_code_id || ""}
      entityFields={SOURCE_CODE_DETAIL_FIELDS}
    >
      <EntityContainer title={"Code Repository"}>
        <SourceCodeContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

SourceCodePage.path = "/source_codes/:source_code_id/:tab?";
