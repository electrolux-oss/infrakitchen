import { useCallback, useState } from "react";

import { useParams } from "react-router";

import { LogLiveTail, PermissionWrapper, useConfig } from "../../common";
import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { entityIcons } from "../../common/components/entities/entityIcons";
import { EntityStatusChip } from "../../common/components/labels/EntityStatusChip";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { HeroCheckBadgeIcon } from "../../icons";
import { Button } from "../../ui";
import { Label } from "../../ui/Label";
import { IntegrationContent } from "../components/IntegrationContent";
import {
  INTEGRATION_DETAILS_FIELDS,
  VALIDATE_INTEGRATION_MUTATION,
} from "../graphql";
import { IntegrationValidationResult } from "../types";
import { integrationTypeChipColor } from "../types";

export const EntityStatusChipSlot = () => {
  const { entity } = useEntityProvider();
  if (!entity?.status) return null;
  return <EntityStatusChip status={entity.status} state={entity.state} />;
};

export const IntegrationHeaderTypeLabel = () => {
  const { entity } = useEntityProvider();
  if (!entity?.integrationType) return null;
  return (
    <Label
      tone={integrationTypeChipColor(entity.integrationType)}
      label={entity.integrationType.toUpperCase()}
    />
  );
};

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
        titleIcon={entityIcons.integration}
        titleAdornment={
          <>
            <IntegrationHeaderTypeLabel />
            <EntityStatusChipSlot />
          </>
        }
        actions={
          <>
            <PermissionWrapper
              requiredPermission={"api:integration"}
              permissionAction="write"
            >
              <Button
                startIcon={<HeroCheckBadgeIcon />}
                variant="outlined"
                onClick={handleValidation}
                loading={loading}
              >
                Validate
              </Button>
            </PermissionWrapper>
            <EntityRefreshButton />
          </>
        }
      >
        <IntegrationContent />
        <LogLiveTail />
      </EntityContainer>
    </EntityProvider>
  );
};

IntegrationPage.path = "/integrations/:integration_id/:tab?";
