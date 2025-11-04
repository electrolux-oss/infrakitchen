import { useState, useEffect, useCallback } from "react";

import { useNavigate, useParams } from "react-router";

import { Typography, Button, Grid, Box, Chip } from "@mui/material";

import { useConfig } from "../../common/context/ConfigContext";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { IntegrationCard } from "../components/IntegrationCard";
import { providers } from "../constants";
import { IntegrationResponse, IntegrationType, ConnectionType } from "../types";

const ListIntegrationsPage = () => {
  const { provider } = useParams<{ provider: string }>();
  const navigate = useNavigate();
  const { ikApi, linkPrefix } = useConfig();

  const isViewAllByType = provider === "git" || provider === "cloud";

  const providerObject = !isViewAllByType
    ? providers.find((p) => p.slug === provider)
    : null;

  const [buffer, setBuffer] = useState<Record<string, IntegrationResponse[]>>(
    {},
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(() => {
    setLoading(true);
    ikApi
      .get("integrations")
      .then((res: IntegrationResponse[]) => {
        setBuffer((prev) => ({ ...prev, integrations: res }));
        setLoading(false);
      })
      .catch((err: any) => {
        const msg = err?.message || "Failed to load integrations";
        setError(msg);
        notifyError(err);
        setLoading(false);
      });
  }, [ikApi]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const integrations = buffer["integrations"] || [];

  if (isViewAllByType) {
    const integrationType = provider as IntegrationType;
    const typeProviders = providers
      .filter((p) => p.type === integrationType)
      .filter((p) => p.connectionType !== ConnectionType.SSH);

    const filtered = integrations
      .filter((integration) => integration.integration_type === integrationType)
      .sort((a, b) => a.name.localeCompare(b.name));

    const groupedByProvider = typeProviders.map((provider) => ({
      provider,
      integrations: filtered.filter(
        (integration) =>
          integration.integration_provider === provider.slug ||
          integration.integration_provider === `${provider.slug}_ssh`,
      ),
    }));

    return (
      <PageContainer
        title={`${integrationType === IntegrationType.GIT ? "Git" : "Cloud"} Integrations`}
        onBack={() => navigate(`${linkPrefix}integrations`)}
      >
        {loading && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            Loading integrations...
          </Typography>
        )}
        {error && (
          <Typography variant="body1" color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
        {filtered.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            No {integrationType} integrations found.
          </Typography>
        ) : (
          <Box
            sx={{
              minWidth: 650,
              maxWidth: 1000,
              width: "75%",
              alignSelf: "center",
            }}
          >
            {groupedByProvider.map(({ provider, integrations }) =>
              integrations.length > 0 ? (
                <Box key={provider.slug} sx={{ mb: 4 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      mb: 2,
                    }}
                  >
                    <provider.icon width="32" height="32" />
                    <Typography variant="h5">{provider.name}</Typography>
                    <Chip
                      label={`${integrations.length} integration${integrations.length !== 1 ? "s" : ""}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                    <Button
                      size="small"
                      onClick={() =>
                        navigate(`${linkPrefix}integrations/${provider.slug}`)
                      }
                    >
                      View Provider
                    </Button>
                    <Button
                      size="small"
                      onClick={() =>
                        navigate(
                          `${linkPrefix}integrations/${provider.slug}/setup`,
                        )
                      }
                    >
                      Create Integration
                    </Button>
                  </Box>
                  <Grid container direction="column" spacing={2}>
                    {integrations.map((integration) => (
                      <IntegrationCard
                        key={integration.id}
                        integration={integration}
                        provider={provider}
                      />
                    ))}
                  </Grid>
                </Box>
              ) : null,
            )}
          </Box>
        )}
      </PageContainer>
    );
  }

  if (providerObject) {
    const filtered = integrations
      .sort((integration1, integration2) => {
        return integration1.name < integration2.name ? -1 : 1;
      })
      .filter(
        (integration) =>
          integration.integration_provider === providerObject.slug ||
          integration.integration_provider === `${providerObject.slug}_ssh`,
      );

    return (
      <PageContainer
        title={`${providerObject.name} Integrations`}
        onBack={() => navigate(`${linkPrefix}integrations`)}
        actions={
          <Button
            variant="outlined"
            color="primary"
            onClick={() =>
              navigate(`${linkPrefix}integrations/${providerObject.slug}/setup`)
            }
          >
            Create
          </Button>
        }
      >
        {loading && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            Loading integrations...
          </Typography>
        )}
        {error && (
          <Typography variant="body1" color="error" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
        {filtered.length === 0 ? (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            No {providerObject.name} integrations found. Click{" "}
            <strong>Create</strong> to get started.
          </Typography>
        ) : (
          <Grid
            container
            direction="column"
            spacing={2}
            sx={{
              minWidth: 650,
              maxWidth: 1000,
              justifySelf: "center",
              width: "75%",
            }}
          >
            {filtered.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                provider={providerObject}
              />
            ))}
          </Grid>
        )}
      </PageContainer>
    );
  }
};

ListIntegrationsPage.path = "/integrations/:provider";

export { ListIntegrationsPage };
