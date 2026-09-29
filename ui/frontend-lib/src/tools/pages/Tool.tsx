import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { ToolContent } from "../components/ToolContent";
import { ToolHeaderActions } from "../components/ToolHeaderActions";
import { TOOL_DETAIL_FIELDS } from "../graphql";

export const ToolPage = () => {
  const { tool_id } = useParams();

  return (
    <EntityProvider
      entity_name="tool"
      entity_id={tool_id || ""}
      entityFields={TOOL_DETAIL_FIELDS}
    >
      <EntityContainer title="Tool Details" actions={<ToolHeaderActions />}>
        <ToolContent />
      </EntityContainer>
    </EntityProvider>
  );
};

ToolPage.path = "/tools/:tool_id/:tab?";
