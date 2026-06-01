import { useParams } from "react-router";

import { LogLiveTail } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { ExecutorContent } from "../components/ExecutorContent";
import { EXECUTOR_DETAIL_FIELDS, transformExecutor } from "../graphql";

export const ExecutorPage = () => {
  const { executor_id } = useParams();

  return (
    <EntityProvider
      entity_name="executor"
      entity_id={executor_id || ""}
      transformFn={transformExecutor}
      entityFields={EXECUTOR_DETAIL_FIELDS}
    >
      <EntityContainer title={"Executor Overview"}>
        <ExecutorContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

ExecutorPage.path = "/executors/:executor_id/:tab?";
