import { useParams } from "react-router";

import { ActivityContainer } from "../../common/components/ActivityContainer";
import { EntityProvider } from "../../common/context/EntityContext";

export const TemplateActivityPage = () => {
  const { template_id } = useParams();

  return (
    <EntityProvider entity_name="template" entity_id={template_id || ""}>
      <ActivityContainer tabs={["audit", "revisions"]} />
    </EntityProvider>
  );
};

TemplateActivityPage.path = "/templates/:template_id/activity";
