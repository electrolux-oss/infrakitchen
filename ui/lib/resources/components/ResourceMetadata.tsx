import { useParams } from "react-router";

import { EntityProvider } from "../../common";
import { RESOURCE_DETAIL_FIELDS } from "../graphql";

import { RelationsComponent } from "./relations";

export function ResourceMetadataPage() {
  const { resource_id } = useParams();

  return (
    <EntityProvider
      entity_name="resource"
      entity_id={resource_id || ""}
      entityFields={RESOURCE_DETAIL_FIELDS}
    >
      <RelationsComponent />
    </EntityProvider>
  );
}

ResourceMetadataPage.path = "/resources/:resource_id/metadata";
