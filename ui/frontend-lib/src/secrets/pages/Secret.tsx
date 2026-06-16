import { useCallback, useState } from "react";

import { useParams } from "react-router";

import TaskAltIcon from "@mui/icons-material/TaskAlt";
import { Button } from "@mui/material";

import { PermissionWrapper, useConfig } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { SecretContent } from "../components/SecretContent";
import {
  SECRET_DETAIL_FIELDS,
  transformSecret,
  VALIDATE_SECRET_MUTATION,
} from "../graphql";
import { SecretValidationResult } from "../types";

export const SecretPage = () => {
  const { secret_id } = useParams();

  const { ikApi } = useConfig();
  const [loading, setLoading] = useState(false);

  const handleValidation = useCallback(async () => {
    if (!secret_id) {
      notifyError(new Error("Secret ID is missing."));
      return;
    }

    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        validateSecret: SecretValidationResult;
      }>(VALIDATE_SECRET_MUTATION, { id: secret_id });

      const result = response.validateSecret;
      if (result.isValid) {
        notify(result.message, "success");
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
  }, [ikApi, secret_id]);

  return (
    <EntityProvider
      entity_name="secret"
      entity_id={secret_id || ""}
      transformFn={transformSecret}
      entityFields={SECRET_DETAIL_FIELDS}
    >
      <EntityContainer
        title={"Secret Overview"}
        hideEditAction
        actions={
          <PermissionWrapper
            requiredPermission="api:secret"
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
        <SecretContent />
      </EntityContainer>
    </EntityProvider>
  );
};

SecretPage.path = "/secrets/:secret_id/:tab?";
