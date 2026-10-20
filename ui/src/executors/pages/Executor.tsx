import { useParams } from "react-router";

import { LogLiveTail } from "../../common";
import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { ScheduleApplyButton } from "../../common/components/buttons/ScheduleApplyButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { HeroCpuChipIcon } from "../../icons";
import { TASK_QUEUE_STATUS_SELECTION } from "../../workers/graphql";
import { CloneExecutorButton } from "../components/CloneExecutorButton";
import { ExecutorContent } from "../components/ExecutorContent";
import { EXECUTOR_DETAIL_FIELDS } from "../graphql";

// Queue state is fetched with the entity in the same request
const PAGE_FIELDS = `${EXECUTOR_DETAIL_FIELDS}${TASK_QUEUE_STATUS_SELECTION}`;

export const ExecutorPage = () => {
  const { executor_id } = useParams();

  return (
    <EntityProvider
      entity_name="executor"
      entity_id={executor_id || ""}
      entityFields={PAGE_FIELDS}
    >
      <EntityContainer
        titleIcon={<HeroCpuChipIcon />}
        actions={
          <>
            <ScheduleApplyButton entityType="executor" />
            <CloneExecutorButton />
            <EntityRefreshButton />
          </>
        }
      >
        <ExecutorContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

ExecutorPage.path = "/executors/:executor_id/:tab?";
