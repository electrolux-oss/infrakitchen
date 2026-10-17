import { useNavigate } from "react-router";

import { PermissionWrapper } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { useConfig } from "../../common/context/ConfigContext";
import PageContainer from "../../common/PageContainer";
import { AddIcon } from "../../icons/material";
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
          startIcon={<AddIcon />}
        >
          Create
        </Button>
      </PermissionWrapper>
    </div>
  );

  return (
    <PageContainer
      title="Blueprints"
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
