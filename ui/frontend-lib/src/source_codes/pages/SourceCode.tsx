import { useParams } from "react-router";

import { LogLiveTail } from "../../common";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { TASK_QUEUE_STATUS_SELECTION } from "../../workers/graphql";
import { SourceCodeContent } from "../components/SourceCodeContent";
import { SOURCE_CODE_DETAIL_FIELDS } from "../graphql";

// Queue state is fetched with the entity in the same request
const PAGE_FIELDS = `${SOURCE_CODE_DETAIL_FIELDS}${TASK_QUEUE_STATUS_SELECTION}`;

export const SourceCodePage = () => {
  const { source_code_id } = useParams();

  return (
    <EntityProvider
      entity_name="sourceCode"
      entity_id={source_code_id || ""}
      entityFields={PAGE_FIELDS}
    >
      <EntityContainer title={"Code Repository"}>
        <SourceCodeContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

SourceCodePage.path = "/source_codes/:source_code_id/:tab?";
