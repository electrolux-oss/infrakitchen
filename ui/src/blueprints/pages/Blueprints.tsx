import { useNavigate } from "react-router";

import { PermissionWrapper } from "../../common";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { useConfig } from "../../common/context/ConfigContext";
import PageContainer from "../../common/PageContainer";
import { HeroPlusCircleIcon } from "../../icons";
import { Button } from "../../ui";
import { blueprintColumns } from "../components/blueprintTableConfig";
import { BLUEPRINT_FIELD_MAP } from "../graphql";

export const BlueprintsPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const actions = (
    <div>
      <PermissionWrapper
        requiredPermission="api:blueprint"
        permissionAction="write"
      >
        <Button
          onClick={() => navigate(`${linkPrefix}blueprints/create`)}
          startIcon={<HeroPlusCircleIcon />}
        >
          Create
        </Button>
      </PermissionWrapper>
    </div>
  );

  return (
    <PageContainer
      title="Blueprints"
      icon={entityIcons.blueprint}
      description="Combine multiple templates into one reusable blueprint that provisions infrastructure as a workflow."
      actions={actions}
    >
      <EntityFetchTable
        title="Blueprints"
        entityName="blueprint"
        columns={blueprintColumns}
        entityFieldMap={BLUEPRINT_FIELD_MAP}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

BlueprintsPage.path = "/blueprints";
