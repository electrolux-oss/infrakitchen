import { useCallback, useState } from "react";

import { useParams } from "react-router";

import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { Button } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { WorkerTemplateContent } from "../components/WorkerTemplateContent";
import {
  VALIDATE_WORKER_TEMPLATE_MUTATION,
  WORKER_TEMPLATE_DETAIL_FIELDS,
} from "../graphql";
import { WorkerTemplateValidationResult } from "../types";

export const WorkerTemplatePage = () => {
  const { worker_template_id } = useParams();
  const { ikApi } = useConfig();
  const [loading, setLoading] = useState(false);

  const handleValidation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        validateWorkerTemplate: WorkerTemplateValidationResult;
      }>(VALIDATE_WORKER_TEMPLATE_MUTATION, { id: worker_template_id });
      const result = response.validateWorkerTemplate;
      if (result.isValid) {
        notify(result.message, "success");
      } else {
        notifyError(new Error(`Validation failed: ${result.message}`));
      }
    } catch (error: any) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi, worker_template_id]);

  return (
    <EntityProvider
      entity_name="workerTemplate"
      entity_id={worker_template_id || ""}
      entityFields={WORKER_TEMPLATE_DETAIL_FIELDS}
    >
      <EntityContainer
        title="Worker Template Details"
        actions={
          <PermissionWrapper
            requiredPermission="api:worker_template"
            permissionAction="admin"
          >
            <Button
              startIcon={<TaskAltIcon />}
              variant="outlined"
              onClick={handleValidation}
              loading={loading}
            >
              Validate
            </Button>
          </PermissionWrapper>
        }
      >
        <WorkerTemplateContent />
      </EntityContainer>
    </EntityProvider>
  );
};

WorkerTemplatePage.path = "/worker_templates/:worker_template_id/:tab?";
