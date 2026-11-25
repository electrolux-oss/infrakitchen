import { useParams } from "react-router";

import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { entityIcons } from "../../common/components/entities/entityIcons";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { ServiceContent } from "../components/ServiceContent";
import { SERVICE_DETAIL_FIELDS } from "../graphql";

export const ServicePage = () => {
  const { service_id } = useParams();

  return (
    <EntityProvider
      entity_name="service"
      entity_id={service_id || ""}
      entityFields={SERVICE_DETAIL_FIELDS}
    >
      <ServicePageContent />
    </EntityProvider>
  );
};

const ServicePageContent = () => {
  const { entity } = useEntityProvider();

  return (
    <EntityContainer
      titleIcon={entityIcons.service}
      title={entity?.name}
      actions={<EntityRefreshButton />}
    >
      <ServiceContent />
    </EntityContainer>
  );
};

ServicePage.path = "services/:service_id/:tab?";
