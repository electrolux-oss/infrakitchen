import { useCallback, useState, useMemo } from "react";

import { Control, useForm, Controller } from "react-hook-form";
import { useNavigate, useParams } from "react-router";

import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  CardHeader,
  Link,
  Tabs,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import { useConfig, StyledTab, LabelInput } from "../../common";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { CREATE_INTEGRATION_WITH_STORAGE_MUTATION } from "../../use_cases/graphql";
import { renderFieldsForProvider } from "../components/IntegrationProviderForms";
import { providers } from "../constants";
import {
  GqlIntegration,
  VALIDATE_INTEGRATION_CONFIG_MUTATION,
} from "../graphql";
import {
  ConnectionType,
  IntegrationValidationResult,
  IntegrationWithStorageCreate,
} from "../types";

const IntegrationCreatePage = () => {
  const { provider } = useParams();
  const navigate = useNavigate();
  const { linkPrefix, ikApi } = useConfig();

  const providerVariants = useMemo(
    () => providers.filter((p) => provider === p.slug),
    [provider],
  );

  const hasMultipleAuthMethods = providerVariants.length > 1;

  const [connectionType, setConnectionType] = useState<ConnectionType>(
    ConnectionType.TOKEN,
  );

  const providerObject = useMemo(
    () =>
      providerVariants.find((p) => p.connectionType === connectionType) ||
      providerVariants[0],
    [providerVariants, connectionType],
  );

  const {
    control,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<IntegrationWithStorageCreate>({
    mode: "onChange",
    defaultValues: {
      name: "",
      integrationType: providerObject?.type,
      integrationProvider: providerObject?.slug,
      description: "",
      labels: [],
      createStorage: false,
      configuration: {},
    },
  });

  const formProviderSlug =
    connectionType === ConnectionType.SSH
      ? `${providerObject.slug}_ssh`
      : providerObject.slug;

  const handleSave = useCallback(
    async (data: any) => {
      const isValid = await trigger();
      if (!isValid) {
        notifyError(new Error("Fix validation errors before saving."));
        return;
      }

      try {
        const response = await ikApi.graphqlRequest<{
          createIntegrationWithStorage: GqlIntegration;
        }>(CREATE_INTEGRATION_WITH_STORAGE_MUTATION, {
          input: {
            name: data.name,
            description: data.description,
            labels: data.labels,
            integrationType: data.integrationType,
            integrationProvider: formProviderSlug,
            createStorage: data.createStorage,
            configuration: {
              ...data.configuration,
              integration_provider: formProviderSlug,
            },
          },
        });

        if (response.createIntegrationWithStorage.id) {
          navigate(`${linkPrefix}integrations`);
          notify("Integration created successfully!", "success");
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, linkPrefix, trigger, navigate, formProviderSlug],
  );

  const handleValidation = useCallback(async () => {
    const isValid = await trigger();
    if (!isValid) {
      notifyError(new Error("Fix validation errors before testing."));
      return;
    }
    const { name, description, labels, configuration, integrationType } =
      getValues();

    const input = {
      name,
      description,
      labels,
      integrationType,
      integrationProvider: formProviderSlug,
      configuration: {
        ...configuration,
        integration_provider: formProviderSlug,
      },
    };

    try {
      const response = await ikApi.graphqlRequest<{
        validateIntegrationConfig: IntegrationValidationResult;
      }>(VALIDATE_INTEGRATION_CONFIG_MUTATION, { input });

      const result = response.validateIntegrationConfig;
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
    }
  }, [ikApi, getValues, trigger, formProviderSlug]);

  if (!providerObject) {
    return (
      <PageContainer title="Integration Not Found">
        <Typography variant="h5">
          The specified integration provider was not found.
        </Typography>
        <Button
          onClick={() => navigate(`${linkPrefix}integrations`)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer title={`Set up ${providerObject?.name} Integration`}>
      {hasMultipleAuthMethods && (
        <Box
          sx={{
            mb: 3,
            width: "100%",
            minWidth: 320,
          }}
        >
          <Tabs
            value={connectionType}
            onChange={(_, newValue: ConnectionType) => {
              setConnectionType(newValue);
            }}
            variant="fullWidth"
            sx={{
              "& .MuiTabs-indicator": {
                display: "none",
              },
            }}
          >
            <StyledTab
              label="Token Authentication"
              value={ConnectionType.TOKEN}
            />
            <StyledTab
              label="SSH Key Authentication"
              value={ConnectionType.SSH}
            />
          </Tabs>
        </Box>
      )}
      <Card
        sx={{
          mb: 4,
          width: "100%",
          minWidth: 320,
        }}
      >
        <CardHeader
          title={
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {providerObject.icon && (
                <providerObject.icon width="50" height="50" />
              )}
              <Box sx={{ ml: 2 }}>
                <Typography variant="h6" component="h2">
                  {providerObject.name} Integration Setup
                </Typography>
                <Typography sx={{ color: "text.secondary" }}>
                  {`Connect ${providerObject.name} to integrate with InfraKitchen.`}
                </Typography>
              </Box>
            </Box>
          }
        />
        <CardContent>
          <Box
            sx={{
              backgroundColor: "action.hover",
              p: 2,
              mx: 3,
              borderRadius: "var(--template-surface-radius)",
              // Code/commands inside instruction steps use the inline code
              // style.
              "& code": {
                fontSize: "0.85em",
                fontFamily: CODE_FONT_FAMILY,
                backgroundColor: "var(--template-palette-action-hover)",
                borderRadius: "var(--template-surface-radius)",
                px: 0.75,
                py: 0.25,
                wordBreak: "break-all",
              },
              "& pre": {
                fontFamily: CODE_FONT_FAMILY,
                fontSize: "0.85em",
                backgroundColor: "var(--template-palette-action-hover)",
                borderRadius: "var(--template-surface-radius)",
                margin: 0.5,
                p: 1,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
              },
            }}
          >
            <Typography sx={{ fontWeight: 600, mb: 1 }}>
              How to connect to {providerObject.name}:
            </Typography>
            <Box
              component="div"
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {providerObject.instructions.map((line, index) => (
                <Box key={index} sx={{ display: "flex", gap: 1.5 }}>
                  <Box
                    component="span"
                    sx={{
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      mt: 0.1,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "primary.main",
                      color: "primary.contrastText",
                      fontSize: "0.75rem",
                      lineHeight: 1,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Box
                    component="span"
                    sx={{ alignSelf: "center" }}
                    dangerouslySetInnerHTML={{ __html: line }}
                  />
                </Box>
              ))}
            </Box>
            {providerObject.tokenLink && (
              <Link
                href={providerObject.tokenLink}
                underline="hover"
                sx={{ display: "block", mt: 2 }}
              >
                Open {providerObject.name} Settings
              </Link>
            )}
          </Box>
        </CardContent>
      </Card>{" "}
      <Card
        sx={{
          width: "100%",
          minWidth: 320,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "var(--template-surface-radius)",
          boxShadow: "none",
        }}
      >
        <CardHeader
          title="Integration Details"
          subheader={`Provide your integration name and ${providerObject.name} ${connectionType === ConnectionType.SSH ? "SSH key" : "token"}`}
        />

        <CardContent>
          <Controller
            name="name"
            control={control}
            rules={{
              required: "Integration Name is required",
              pattern: {
                value: /^[a-zA-Z0-9_-]+$/,
                message:
                  "Only letters, numbers, underscore, and hyphen allowed",
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Integration Name"
                error={!!errors.name}
                required
                helperText={
                  errors.name ? errors.name.message : "Provide a unique name"
                }
                fullWidth
                margin="normal"
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Description"
                helperText={
                  errors.description
                    ? errors.description.message
                    : "Provide a short description"
                }
                fullWidth
                margin="normal"
              />
            )}
          />

          <Controller
            name="labels"
            control={control}
            render={({ field }) => <LabelInput {...field} errors={errors} />}
          />
          {renderFieldsForProvider(
            formProviderSlug,
            control as Control<any>,
            errors,
            false,
            true,
          )}
        </CardContent>
        <CardActions
          sx={{
            display: "flex",
            gap: 2,
            mt: 2,
            mb: 1,
            justifyContent: "center",
          }}
        >
          <Button onClick={handleValidation}>Test Connection</Button>
          <Button
            variant="contained"
            onClick={handleSubmit(handleSave, () =>
              notifyError(new Error("Fix validation errors before saving.")),
            )}
          >
            Save
          </Button>
        </CardActions>
      </Card>
    </PageContainer>
  );
};

IntegrationCreatePage.path = "/integrations/:provider/setup";

export { IntegrationCreatePage };
