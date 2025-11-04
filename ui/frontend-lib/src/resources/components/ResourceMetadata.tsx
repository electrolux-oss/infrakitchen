import { useParams } from "react-router";

import { EntityProvider } from "../../common";

import { RelationsComponent } from "./relations";

export function ResourceMetadataPage() {
  const { resource_id } = useParams();

  return (
    <EntityProvider entity_name="resource" entity_id={resource_id || ""}>
      <RelationsComponent />
    </EntityProvider>
  );
}

ResourceMetadataPage.path = "/resources/:resource_id/metadata";
