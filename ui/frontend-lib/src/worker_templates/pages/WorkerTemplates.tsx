import { useNavigate } from "react-router";

import AddIcon from "@mui/icons-material/Add";
import { Button } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import {
  workerTemplateColumns,
  workerTemplateDefaultColumnVisibilityModel,
} from "../components/workerTemplateTableConfig";
import { WORKER_TEMPLATE_FIELD_MAP } from "../graphql";

export const WorkerTemplatesPage = () => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  return (
    <PageContainer
      title="Worker Templates"
      description="Spawn task workers on demand when tasks are waiting, and remove them once they are idle."
      actions={
        <PermissionWrapper
          requiredPermission="api:worker_template"
          permissionAction="write"
        >
          <Button
            onClick={() => navigate(`${linkPrefix}worker_templates/create`)}
            startIcon={<AddIcon />}
          >
            Create
          </Button>
        </PermissionWrapper>
      }
    >
      <EntityFetchTable
        title="Worker Templates"
        entityName="workerTemplate"
        columns={workerTemplateColumns}
        defaultColumnVisibilityModel={
          workerTemplateDefaultColumnVisibilityModel
        }
        entityFieldMap={WORKER_TEMPLATE_FIELD_MAP}
      />
    </PageContainer>
  );
};

WorkerTemplatesPage.path = "/worker_templates";
