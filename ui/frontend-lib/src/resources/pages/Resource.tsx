import { useState } from "react";

import { useNavigate, useParams } from "react-router";

import { Button, Tooltip } from "@mui/material";

import { LogLiveTail, PermissionWrapper, useConfig } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { SubscribeNotificationButton } from "../components/notifications/SubscribeNotificationButton";
import { ResourceContent } from "../components/ResourceContent";
import { ResourceReviewView } from "../components/ResourceReviewView";
import { RESOURCE_DETAIL_FIELDS, transformResource } from "../graphql";
import { useResourceNotificationDialog } from "../hooks/useResourceNotificationDialog";

export const ResourcePage = () => {
  const { resource_id } = useParams();
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  const [subscribersRefreshKey, setSubscribersRefreshKey] = useState(0);

  const { loading, isSubscribed, handleSubscribe, handleUnsubscribe } =
    useResourceNotificationDialog({
      resourceId: resource_id || "",
      onSubscriptionChange: () =>
        setSubscribersRefreshKey((currentKey) => currentKey + 1),
    });

  const handleSubscribeClick = (inheritChildren: boolean) => {
    void handleSubscribe(inheritChildren);
  };

  const handleUnsubscribeClick = (inheritChildren: boolean) => {
    void handleUnsubscribe(inheritChildren);
  };

  const handleMetadata = () => {
    navigate(`${linkPrefix}resources/${resource_id}/metadata`);
  };

  return (
    <EntityProvider
      entity_name="resource"
      entity_id={resource_id || ""}
      transformFn={transformResource}
      entityFields={RESOURCE_DETAIL_FIELDS}
    >
      <EntityContainer
        title={"Resource Overview"}
        actions={
          <>
            <SubscribeNotificationButton
              isSubscribed={isSubscribed}
              isLoading={loading}
              onSubscribeClick={handleSubscribeClick}
              onUnsubscribeClick={handleUnsubscribeClick}
            />
            <PermissionWrapper
              requiredPermission="api:resource"
              permissionAction="read"
            >
              <Tooltip title="View resource metadata">
                <Button variant="outlined" onClick={handleMetadata}>
                  Metadata
                </Button>
              </Tooltip>
            </PermissionWrapper>
          </>
        }
      >
        <ResourceReviewView />
        <ResourceContent subscribersRefreshKey={subscribersRefreshKey} />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

ResourcePage.path = "/resources/:resource_id/:tab?";
