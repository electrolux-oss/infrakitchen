import { useParams } from "react-router";

import { LogLiveTail } from "../../common";
import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { ScheduleApplyButton } from "../../common/components/buttons/ScheduleApplyButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { EntityProvider } from "../../common/context/EntityContext";
import { TASK_QUEUE_STATUS_SELECTION } from "../../workers/graphql";
import { ResourceContent } from "../components/ResourceContent";
import { ResourceMoreMenu } from "../components/ResourceMoreMenu";
import { RESOURCE_DETAIL_FIELDS } from "../graphql";

// Queue state is fetched with the entity in the same request
const PAGE_FIELDS = `${RESOURCE_DETAIL_FIELDS}${TASK_QUEUE_STATUS_SELECTION}`;

export const ResourcePage = () => {
  const { resource_id } = useParams();

  return (
    <EntityProvider
      entity_name="resource"
      entity_id={resource_id || ""}
      entityFields={PAGE_FIELDS}
    >
      <EntityContainer
        titleIcon={entityIcons.resource}
        actions={
          <>
            <ScheduleApplyButton entityType="resource" />
            <ResourceMoreMenu />
            <EntityRefreshButton />
          </>
        }
      >
        <ResourceContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

ResourcePage.path = "/resources/:resource_id/:tab?";
