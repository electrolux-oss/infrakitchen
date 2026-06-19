import { useCallback, useState } from "react";

import { useParams } from "react-router";

import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { Button } from "@mui/material";

import { LogLiveTail, PermissionWrapper, useConfig } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { IntegrationContent } from "../components/IntegrationContent";
import {
  INTEGRATION_DETAILS_FIELDS,
  VALIDATE_INTEGRATION_MUTATION,
} from "../graphql";
import { IntegrationValidationResult } from "../types";

export const IntegrationPage = () => {
  const { integration_id } = useParams();
  const { ikApi } = useConfig();
  const [loading, setLoading] = useState(false);

  const handleValidation = useCallback(async () => {
    if (!integration_id) {
      notifyError(new Error("Integration ID is missing."));
      return;
    }

    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        validateIntegration: IntegrationValidationResult;
      }>(VALIDATE_INTEGRATION_MUTATION, { id: integration_id });

      const result = response.validateIntegration;
      if (result.isValid) {
        notify("Validation successful!", "success");
      } else {
        notifyError(
          new Error(
            `Validation failed: ${result.message || "No message provided."}`,
          ),
        );
      }
    } catch (error: any) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi, integration_id]);

  return (
    <EntityProvider
      entity_name="integration"
      entity_id={integration_id || ""}
      entityFields={INTEGRATION_DETAILS_FIELDS}
    >
      <EntityContainer
        title={"Integration Overview"}
        actions={
          <PermissionWrapper
            requiredPermission={"api:integration"}
            permissionAction="write"
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
        <IntegrationContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

IntegrationPage.path = "/integrations/:provider/:integration_id/:tab?";
