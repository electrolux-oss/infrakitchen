import { useNavigate } from "react-router";

import { Box, Button } from "@mui/material";

import { PermissionWrapper } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { useConfig } from "../../common/context/ConfigContext";
import PageContainer from "../../common/PageContainer";
import { blueprintColumns } from "../components/blueprintTableConfig";
import { BLUEPRINT_FIELD_MAP } from "../graphql";

export const BlueprintsPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  const actions = (
    <Box>
      <PermissionWrapper
        requiredPermission="api:blueprint"
        permissionAction="write"
      >
        <Button onClick={() => navigate(`${linkPrefix}blueprints/create`)}>
          Create
        </Button>
      </PermissionWrapper>
    </Box>
  );

  return (
    <PageContainer title="Blueprints" actions={actions}>
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
