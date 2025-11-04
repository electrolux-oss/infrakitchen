import { useCallback, useState, useMemo } from "react";

import { useForm, Controller } from "react-hook-form";
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
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { renderFieldsForProvider } from "../components/IntegrationProviderForms";
import { providers } from "../constants";
import {
  ConnectionType,
  IntegrationResponse,
  IntegrationValidateRequest,
  IntegrationValidateResponse,
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
      integration_type: providerObject?.type,
      integration_provider: providerObject?.slug,
      description: "",
      labels: [],
      create_storage: false,
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

      const payload = {
        ...data,
        integration_provider: formProviderSlug,
        configuration: {
          ...data.configuration,
          integration_provider: formProviderSlug,
        },
      };
      ikApi
        .postRaw("use_cases/create_integration_with_storage", payload)
        .then((response: IntegrationResponse) => {
          if (response.id) {
            navigate(`${linkPrefix}integrations/${providerObject?.slug}`);
            notify("Integration created successfully!", "success");
          }
        })
        .catch((error: any) => {
          notifyError(error);
        });
    },
    [ikApi, linkPrefix, providerObject, trigger, navigate, formProviderSlug],
  );

  const handleValidation = useCallback(async () => {
    const isValid = await trigger();
    if (!isValid) {
      notifyError(new Error("Fix validation errors before testing."));
      return;
    }
    const { configuration, integration_type } = getValues();

    const payload: IntegrationValidateRequest = {
      integration_type,
      integration_provider: formProviderSlug,
      configuration: {
        ...configuration,
        integration_provider: formProviderSlug,
      },
    };
    ikApi
      .postRaw("integrations/validate", payload)
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
      });
  }, [ikApi, getValues, trigger, formProviderSlug]);

  if (!providerObject) {
    return (
      <PageContainer
        title="Integration Not Found"
        onBack={() => navigate(`${linkPrefix}integrations`)}
      >
        <Typography variant="h5">
          The specified integration provider was not found.
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate(`${linkPrefix}integrations`)}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={`Set up ${providerObject?.name} Integration`}
      onBack={() =>
        navigate(`${linkPrefix}integrations/${providerObject?.slug}`)
      }
    >
      {hasMultipleAuthMethods && (
        <Box
          sx={{
            mb: 3,
            width: "75%",
            minWidth: 320,
            maxWidth: 1000,
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
          width: "75%",
          minWidth: 320,
          maxWidth: 1000,
        }}
      >
        <CardHeader
          title={
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {providerObject.icon && (
                <providerObject.icon width="50" height="50" />
              )}
              <Box sx={{ ml: 2 }}>
                <Typography variant="h5" component="h2">
                  {providerObject.name} Integration Setup
                </Typography>
                <Typography variant="body2">
                  {`Connect ${providerObject.name} to integrate with InfraKitchen.`}
                </Typography>
              </Box>
            </Box>
          }
        />
        <CardContent>
          <Box
            sx={{
              backgroundColor: (t) => alpha(t.palette.grey[600], 0.2),
              p: "1rem 2rem",
              m: "0 3rem",
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" sx={{ mb: 1 }}>
              <strong>How to connect to {providerObject.name}:</strong>
            </Typography>
            <Typography variant="body2" component="div">
              {providerObject.instructions.map((line, index) => (
                <div key={index}>
                  {index + 1}.{" "}
                  <span dangerouslySetInnerHTML={{ __html: line }} />
                </div>
              ))}
            </Typography>
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
      </Card>

      <Card
        sx={{
          width: "75%",
          minWidth: 320,
          maxWidth: 1000,
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
                  errors.name
                    ? errors.name.message
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
            control,
            errors,
            false,
            true,
          )}
        </CardContent>
        <CardActions sx={{ display: "flex", gap: 2, mt: 2, mb: 1 }}>
          <Button
            variant="outlined"
            onClick={handleValidation}
            sx={{ flex: 1 }}
          >
            Test Connection
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(handleSave, () =>
              notifyError(new Error("Fix validation errors before saving.")),
            )}
            sx={{ flex: 1 }}
          >
            Save Integration
          </Button>
        </CardActions>
      </Card>
    </PageContainer>
  );
};

IntegrationCreatePage.path = "/integrations/:provider/setup";

export { IntegrationCreatePage };
