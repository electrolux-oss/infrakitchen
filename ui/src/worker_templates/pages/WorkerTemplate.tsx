import { useParams } from "react-router";

import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { HeroRocketLaunchIcon } from "../../icons";
import { WorkerTemplateContent } from "../components/WorkerTemplateContent";
import { WorkerTemplateHeaderActions } from "../components/WorkerTemplateHeaderActions";
import { WORKER_TEMPLATE_DETAIL_FIELDS } from "../graphql";

export const WorkerTemplatePage = () => {
  const { worker_template_id } = useParams();

  return (
    <EntityProvider
      entity_name="workerTemplate"
      entity_id={worker_template_id || ""}
      entityFields={WORKER_TEMPLATE_DETAIL_FIELDS}
    >
      <EntityContainer
        titleIcon={<HeroRocketLaunchIcon />}
        actions={
          <>
            <WorkerTemplateHeaderActions />
            <EntityRefreshButton />
          </>
        }
      >
        <WorkerTemplateContent />
      </EntityContainer>
    </EntityProvider>
  );
};

WorkerTemplatePage.path = "/worker_templates/:worker_template_id/:tab?";
