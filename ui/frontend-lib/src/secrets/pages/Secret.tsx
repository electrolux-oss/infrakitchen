import { useCallback, useState } from "react";

import { useParams } from "react-router";

import { Button } from "@mui/material";

import { LogLiveTail, useConfig } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import { EntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { SecretContent } from "../components/SecretContent";
import { SecretValidateResponse } from "../types";

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
    ikApi
      .get(`secrets/${secret_id}/validate`)
      .then((response: SecretValidateResponse) => {
        if (response.is_valid) {
          notify(response.message, "success");
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
  }, [ikApi, secret_id]);

  return (
    <EntityProvider entity_name="secret" entity_id={secret_id || ""}>
      <EntityContainer
        title={"Secret Overview"}
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
        <SecretContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

SecretPage.path = "/secrets/:secret_id";
