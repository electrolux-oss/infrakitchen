import { useMemo } from "react";

import { useNavigate } from "react-router";

import { useConfig } from "../../common";
import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import {
  taskColumns,
  taskDefaultColumnVisibilityModel,
} from "../components/taskTableConfig";
import { TASK_FIELD_MAP } from "../graphql";

export const TasksPage = () => {
  const { linkPrefix, globalConfig } = useConfig();

  const navigate = useNavigate();

  const columns = useMemo(
    () =>
      taskColumns({
        navigate,
        linkPrefix,
        entityOptions: globalConfig.entities,
      }),
    [navigate, linkPrefix, globalConfig.entities],
  );

  return (
    <PageContainer
      title="Tasks"
      description="Background operations running against your entities, such as plans, applies, and syncs."
    >
      <EntityFetchTable
        title="Tasks"
        entityName="task"
        columns={columns}
        entityFieldMap={TASK_FIELD_MAP}
        defaultColumnVisibilityModel={taskDefaultColumnVisibilityModel}
        syncFiltersToUrl
        // Tasks have no detail page — rows shouldn't navigate (or look clickable).
        rowClickable={false}
      />
    </PageContainer>
  );
};

TasksPage.path = "/tasks";
