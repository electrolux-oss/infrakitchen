import { useState } from "react";

import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { SubscribeNotificationButton } from "../../resources/components/notifications/SubscribeNotificationButton";
import { ProjectContent } from "../components/ProjectContent";
import { PROJECT_DETAIL_FIELDS } from "../graphql";
import { useProjectNotificationDialog } from "../hooks";

export const ProjectPage = () => {
  const { project_id } = useParams();
  const [subscribersRefreshKey, setSubscribersRefreshKey] = useState(0);

  const { loading, isSubscribed, handleSubscribe, handleUnsubscribe } =
    useProjectNotificationDialog({
      projectId: project_id || "",
      onSubscriptionChange: () =>
        setSubscribersRefreshKey((currentKey) => currentKey + 1),
    });

  return (
    <EntityProvider
      entity_name="project"
      entity_id={project_id || ""}
      entityFields={PROJECT_DETAIL_FIELDS}
    >
      <EntityContainer
        title={"Project Details"}
        actions={
          <SubscribeNotificationButton
            isSubscribed={isSubscribed}
            isLoading={loading}
            onSubscribeClick={() => {
              void handleSubscribe();
            }}
            onUnsubscribeClick={() => {
              void handleUnsubscribe();
            }}
            entityName="project"
            showIncludeChildren={false}
          />
        }
      >
        <ProjectContent subscribersRefreshKey={subscribersRefreshKey} />
      </EntityContainer>
    </EntityProvider>
  );
};

ProjectPage.path = "projects/:project_id/:tab?";
