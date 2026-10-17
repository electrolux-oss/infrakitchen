import { useNavigate, useParams } from "react-router";

import { LogLiveTail, PermissionWrapper, useConfig } from "../../common";
import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { ScheduleApplyButton } from "../../common/components/buttons/ScheduleApplyButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { Button, Tooltip } from "../../ui";
import { TASK_QUEUE_STATUS_SELECTION } from "../../workers/graphql";
import { ResourceContent } from "../components/ResourceContent";
import { ResourceReviewView } from "../components/ResourceReviewView";
import { RESOURCE_DETAIL_FIELDS } from "../graphql";

// Queue state is fetched with the entity in the same request
const PAGE_FIELDS = `${RESOURCE_DETAIL_FIELDS}${TASK_QUEUE_STATUS_SELECTION}`;

export const ResourcePage = () => {
  const { resource_id } = useParams();
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  const handleMetadata = () => {
    navigate(`${linkPrefix}resources/${resource_id}/metadata`);
  };

  return (
    <EntityProvider
      entity_name="resource"
      entity_id={resource_id || ""}
      entityFields={PAGE_FIELDS}
    >
      <EntityContainer
        banner={<ResourceReviewView />}
        actions={
          <>
            <ScheduleApplyButton entityType="resource" />
            <PermissionWrapper
              requiredPermission="api:resource"
              permissionAction="read"
            >
              <Tooltip title="View resource metadata">
                <Button onClick={handleMetadata}>Metadata</Button>
              </Tooltip>
            </PermissionWrapper>
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
