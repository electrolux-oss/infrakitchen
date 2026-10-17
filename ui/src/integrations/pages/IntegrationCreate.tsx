import { useCallback, useState, useMemo } from "react";

import { Control, useForm, Controller } from "react-hook-form";
import { useNavigate, useParams } from "react-router";

import { useConfig, StyledTab, LabelInput } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import {
  Button,
  TextField,
  Card,
  CardContent,
  CardActions,
  CardHeader,
  Tabs,
  Link,
} from "../../ui";
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
        <h5 className="m-0 text-h5">
          The specified integration provider was not found.
        </h5>
        <Button
          className="mt-4"
          onClick={() => navigate(`${linkPrefix}integrations`)}
        >
          Go Back
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer title={`Set up ${providerObject?.name} Integration`}>
      {hasMultipleAuthMethods && (
        <div className="mb-6 w-full min-w-80">
          <Tabs
            hideIndicator
            value={connectionType}
            onChange={(_, newValue: ConnectionType) => {
              setConnectionType(newValue);
            }}
            variant="fullWidth"
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
        </div>
      )}
      <Card className="mb-8 w-full min-w-80">
        <CardHeader
          title={
            <div className="flex items-center">
              {providerObject.icon && (
                <providerObject.icon width="50" height="50" />
              )}
              <div className="ml-4">
                <h2 className="m-0 text-h6">
                  {providerObject.name} Integration Setup
                </h2>
                <p className="m-0 text-body2 text-fg-muted">
                  {`Connect ${providerObject.name} to integrate with InfraKitchen.`}
                </p>
              </div>
            </div>
          }
        />
        <CardContent>
          {/* Inline code inside instruction steps renders through the shared
              InlineCode component; block snippets keep the code-font look. */}
          <div className="mx-6 rounded-surface bg-hover p-4 [&_pre]:m-1 [&_pre]:overflow-x-auto [&_pre]:rounded-code [&_pre]:bg-hover [&_pre]:p-2 [&_pre]:font-mono [&_pre]:text-[0.85em] [&_pre]:whitespace-pre-wrap">
            <p className="m-0 mb-2 text-body2 font-semibold">
              How to connect to {providerObject.name}:
            </p>
            <div className="flex flex-col gap-2">
              {providerObject.instructions.map((line, index) => (
                <div className="flex gap-3" key={index}>
                  <span className="mt-[0.8px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.75rem] leading-[1] text-primary-contrast">
                    {index + 1}
                  </span>
                  <span className="self-center">{line}</span>
                </div>
              ))}
            </div>
            {providerObject.tokenLink && (
              <Link className="mt-4 block" href={providerObject.tokenLink}>
                Open {providerObject.name} Settings
              </Link>
            )}
          </div>
        </CardContent>
      </Card>{" "}
      <Card className="w-full min-w-80 rounded-surface border border-divider shadow-none">
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
        <CardActions className="mt-4 mb-2 flex justify-center gap-4">
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
