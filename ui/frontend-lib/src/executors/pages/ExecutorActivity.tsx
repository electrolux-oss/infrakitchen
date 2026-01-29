import { useParams } from "react-router";

import { EntityProvider } from "../../common";
import { ActivityContainer } from "../../common/components/ActivityContainer";

export const ExecutorActivityPage = () => {
  const { executor_id } = useParams();

  return (
    <EntityProvider entity_name="executor" entity_id={executor_id || ""}>
      <ActivityContainer tabs={["audit", "logs", "revisions"]} />
    </EntityProvider>
  );
};

ExecutorActivityPage.path = "/executors/:executor_id/activity";
