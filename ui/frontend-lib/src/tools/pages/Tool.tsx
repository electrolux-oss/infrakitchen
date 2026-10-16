import { useParams } from "react-router";

import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { ToolContent } from "../components/ToolContent";
import { ToolHeaderActions } from "../components/ToolHeaderActions";
import { TOOL_DETAIL_FIELDS } from "../graphql";
import { ToolDetail, toolLabel } from "../types";

export const ToolPage = () => {
  const { tool_id } = useParams();

  return (
    <EntityProvider
      entity_name="tool"
      entity_id={tool_id || ""}
      entityFields={TOOL_DETAIL_FIELDS}
    >
      <ToolPageContent />
    </EntityProvider>
  );
};

const ToolPageContent = () => {
  const { entity } = useEntityProvider();
  const tool = entity as ToolDetail | undefined;

  return (
    // Tools are headed by name, version and platform, as the overview card was.
    <EntityContainer
      title={tool ? toolLabel(tool) : undefined}
      actions={
        <>
          <ToolHeaderActions />
          <EntityRefreshButton />
        </>
      }
    >
      <ToolContent />
    </EntityContainer>
  );
};

ToolPage.path = "/tools/:tool_id/:tab?";
