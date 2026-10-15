import { useParams } from "react-router";

import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { ProjectContent } from "../components/ProjectContent";
import { PROJECT_DETAIL_FIELDS } from "../graphql";

export const ProjectPage = () => {
  const { project_id } = useParams();

  return (
    <EntityProvider
      entity_name="project"
      entity_id={project_id || ""}
      entityFields={PROJECT_DETAIL_FIELDS}
    >
      <EntityContainer actions={<EntityRefreshButton />}>
        <ProjectContent />
      </EntityContainer>
    </EntityProvider>
  );
};

ProjectPage.path = "projects/:project_id/:tab?";
