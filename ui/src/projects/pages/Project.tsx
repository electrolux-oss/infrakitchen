import { useParams } from "react-router";

import { CreateMenuButton } from "../../common/components/buttons/CreateMenuButton";
import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { entityIcons } from "../../common/components/entities/entityIcons";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { ProjectContent } from "../components/ProjectContent";
import { PROJECT_DETAIL_FIELDS } from "../graphql";

const CreateResourceButton = () => {
  const { entity } = useEntityProvider();

  if (!entity?.id) return null;

  return (
    <CreateMenuButton
      options={[
        {
          label: "Resource",
          path: "resources/create",
          state: { project_id: entity.id },
          permission: "api:resource",
        },
      ]}
    />
  );
};

export const ProjectPage = () => {
  const { project_id } = useParams();

  return (
    <EntityProvider
      entity_name="project"
      entity_id={project_id || ""}
      entityFields={PROJECT_DETAIL_FIELDS}
    >
      <EntityContainer
        titleIcon={entityIcons.project}
        actions={
          <>
            <CreateResourceButton />
            <EntityRefreshButton />
          </>
        }
      >
        <ProjectContent />
      </EntityContainer>
    </EntityProvider>
  );
};

ProjectPage.path = "projects/:project_id/:tab?";
