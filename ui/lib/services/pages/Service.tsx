import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
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
      <EntityContainer title={"Service Details"}>
        <ServiceContent />
      </EntityContainer>
    </EntityProvider>
  );
};

ServicePage.path = "services/:service_id/:tab?";
