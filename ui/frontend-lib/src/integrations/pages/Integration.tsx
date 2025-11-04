import { useCallback, useState } from "react";

import { useParams } from "react-router";

import { Button } from "@mui/material";

import { LogLiveTail, useConfig } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { IntegrationContent } from "../components/IntegrationContent";
import { IntegrationValidateResponse } from "../types";

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
    ikApi
      .get(`integrations/${integration_id}/validate`)
      .then((response: IntegrationValidateResponse) => {
        if (response.is_valid) {
          notify("Validation successful!", "success");
        } else {
          notifyError(
            new Error(
              `Validation failed: ${response.message || "No message provided."}`,
            ),
          );
        }
      })
      .catch((error: any) => {
        notifyError(error);
      })
      .finally(() => setLoading(false));
  }, [ikApi, integration_id]);

  return (
    <EntityProvider entity_name="integration" entity_id={integration_id || ""}>
      <EntityContainer
        title={"Integration Overview"}
        actions={
          <Button
            variant="outlined"
            onClick={handleValidation}
            disabled={loading}
          >
            {loading ? "Validating..." : "Validate"}
          </Button>
        }
      >
        <IntegrationContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

IntegrationPage.path = "/integrations/:provider/:integration_id";
