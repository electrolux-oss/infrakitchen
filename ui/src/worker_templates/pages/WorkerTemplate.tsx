import { useParams } from "react-router";

import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { HeroRocketLaunchIcon } from "../../icons";
import { WorkerTemplateContent } from "../components/WorkerTemplateContent";
import { WORKER_TEMPLATE_FIELDS } from "../graphql";

export const WorkerTemplatePage = () => {
  const { worker_template_id } = useParams();

  return (
    <EntityProvider
      entity_name="workerTemplate"
      entity_id={worker_template_id || ""}
      entityFields={WORKER_TEMPLATE_FIELDS}
    >
      <EntityContainer titleIcon={<HeroRocketLaunchIcon />}>
        <WorkerTemplateContent />
      </EntityContainer>
    </EntityProvider>
  );
};

WorkerTemplatePage.path = "/worker_templates/:worker_template_id/:tab?";
