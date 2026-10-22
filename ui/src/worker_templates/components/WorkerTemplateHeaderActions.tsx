import { useState } from "react";

import { useConfig } from "../../common";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { Button } from "../../ui";
import {
  GqlWorkerTemplate,
  SET_DEFAULT_WORKER_TEMPLATE_MUTATION,
} from "../graphql";

/** Header action of the worker template page, clearing the default is in the danger zone. */
export const WorkerTemplateHeaderActions = () => {
  const { ikApi } = useConfig();
  const { entity, actions, refreshEntity, refreshActions } =
    useEntityProvider();
  const workerTemplate = entity as GqlWorkerTemplate | undefined;
  const [submitting, setSubmitting] = useState(false);

  if (!workerTemplate || !actions.includes("set_default")) {
    return null;
  }

  const setDefault = async () => {
    try {
      setSubmitting(true);
      await ikApi.graphqlRequest(SET_DEFAULT_WORKER_TEMPLATE_MUTATION, {
        id: workerTemplate.id,
      });
      notify(`${workerTemplate.name} is the global default`, "success");
      refreshEntity?.();
      refreshActions?.();
    } catch (error: any) {
      notifyError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button onClick={setDefault} disabled={submitting}>
      Set default
    </Button>
  );
};
