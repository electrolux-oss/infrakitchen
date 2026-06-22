import { useState, useCallback } from "react";

import {
  useForm,
  Controller,
  useFormContext,
  FormProvider,
} from "react-hook-form";
import { useNavigate } from "react-router";

import { Box, TextField, Button, MenuItem } from "@mui/material";

import { LabelInput } from "../../common";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import AzureDevopsProjects from "../../providers/azure_devops/Projects";
import AzureDevopsRepos from "../../providers/azure_devops/Repos";
import BitbucketOrganizations from "../../providers/bitbucket/Organizations";
import BitbucketRepos from "../../providers/bitbucket/Repos";
import GithubOrganizations from "../../providers/github/Organizations";
import GithubRepos from "../../providers/github/Repos";
import { IkEntity } from "../../types";
import { CREATE_WORKSPACE_MUTATION } from "../graphql";
import { WorkspaceCreate } from "../types";

const workspace_providers = ["github", "bitbucket", "azure_devops"];

const WorkspaceCreatePageInner = () => {
  const { ikApi, linkPrefix } = useConfig();
  const {
    control,
    formState: { errors },
    watch,
    getValues,
    trigger,
    handleSubmit,
    setValue,
  } = useFormContext<WorkspaceCreate>();

  const selectedProvider = watch("workspaceProvider");
  const selectedIntegration = watch("integrationId");
  const selectedOrg = watch("configuration.organization");
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const handleBack = () => navigate(`${linkPrefix}workspaces`);

  const handleSave = useCallback(
    async (data: WorkspaceCreate) => {
      setSaving(true);
      const isValid = await trigger();
      if (!isValid) {
        setSaving(false);
        notifyError(new Error("Please fix the errors in the form"));
        return;
      }
      const updatedData = {
        description: data.description,
        workspaceProvider: data.workspaceProvider,
        integrationId: data.integrationId,
        labels: data.labels,
        configuration: {
          ...data.configuration,
          workspace_provider: data.workspaceProvider,
        },
      };

      ikApi
        .graphqlRequest<{ createWorkspace: { id: string; name: string } }>(
          CREATE_WORKSPACE_MUTATION,
          { input: updatedData },
        )
        .then((response) => {
          const created = response.createWorkspace;
          if (created?.id) {
            notify("Workspace created successfully", "success");
            navigate(`${linkPrefix}workspaces/${created.id}`);
          }
        })
        .catch((error: any) => {
          notifyError(error);
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [ikApi, navigate, trigger, setSaving, linkPrefix],
  );

  return (
    <PageContainer
      title="Create Workspace"
      onBack={handleBack}
      backAriaLabel="Back to workspaces"
      bottomActions={
        <>
          <Button variant="outlined" color="primary" onClick={handleBack}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(handleSave)}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          width: "75%",
          minWidth: 320,
          maxWidth: 1000,
        }}
      >
        <PropertyCard title="Workspace Definition">
          <Box>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Description"
                  variant="outlined"
                  error={!!errors.description}
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
              defaultValue={[]}
              render={({ field }) => <LabelInput {...field} errors={errors} />}
            />

            <Controller
              name="workspaceProvider"
              control={control}
              rules={{ required: "Workspace provider is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    setValue("integrationId", "");
                    setValue("configuration", {});
                    setBuffer({});
                  }}
                  select
                  label="Workspace Provider"
                  variant="outlined"
                  error={!!errors.workspaceProvider}
                  helperText={
                    errors.workspaceProvider
                      ? errors.workspaceProvider.message
                      : "Select the workspace provider"
                  }
                  fullWidth
                  margin="normal"
                >
                  {workspace_providers.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            {selectedProvider && (
              <Controller
                name="integrationId"
                control={control}
                rules={{ required: "Integration is required" }}
                render={({ field }) => (
                  <ReferenceInput
                    ikApi={ikApi}
                    buffer={buffer}
                    setBuffer={setBuffer}
                    {...field}
                    onChange={(val: any) => {
                      field.onChange(val);
                      setValue("configuration", {});
                      setBuffer(
                        (prev: Record<string, IkEntity | IkEntity[]>) => ({
                          integrations: prev["integrations"],
                        }),
                      );
                    }}
                    entity_name="integrations"
                    filter={{
                      integration_type: "git",
                      integration_provider: selectedProvider,
                    }}
                    error={!!errors.integrationId}
                    helpertext={
                      errors.integrationId
                        ? errors.integrationId.message
                        : "Select credentials for the workspace"
                    }
                    value={field.value}
                    label="Select Integration"
                    required
                  />
                )}
              />
            )}
          </Box>
        </PropertyCard>

        {selectedProvider && selectedIntegration && (
          <PropertyCard title="Workspace Configuration">
            <Box>
              {selectedProvider === "bitbucket" && (
                <Controller
                  name="configuration.organization"
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <BitbucketOrganizations
                      ikApi={ikApi}
                      buffer={buffer}
                      setBuffer={setBuffer}
                      queryParams={{
                        integration_id: getValues("integrationId"),
                      }}
                      {...field}
                      entity_name="bitbucket_organizations"
                      filter={{
                        integration_id: getValues("integrationId"),
                      }}
                      error={!!errors.configuration?.organization}
                      helpertext={
                        errors.configuration?.organization
                          ? errors.configuration?.organization.message
                          : "Select organization for the workspace"
                      }
                      value={field.value}
                      label="Select Organization"
                    />
                  )}
                />
              )}
              {selectedProvider === "github" && (
                <Controller
                  name="configuration.organization"
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <GithubOrganizations
                      ikApi={ikApi}
                      buffer={buffer}
                      setBuffer={setBuffer}
                      queryParams={{
                        integration_id: getValues("integrationId"),
                      }}
                      {...field}
                      error={!!errors.configuration?.organization}
                      helpertext={
                        errors.configuration?.organization
                          ? errors.configuration?.organization.message
                          : "Select organization for the workspace"
                      }
                      value={field.value}
                      label="Select Organization"
                    />
                  )}
                />
              )}
              {selectedProvider === "azure_devops" && (
                <Controller
                  name="configuration.organization"
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <AzureDevopsProjects
                      ikApi={ikApi}
                      buffer={buffer}
                      setBuffer={setBuffer}
                      queryParams={{
                        integration_id: getValues("integrationId"),
                      }}
                      {...field}
                      value={field.value}
                      label="Project Name"
                      error={!!errors.configuration?.organization}
                      helperText={
                        errors.configuration?.organization
                          ? errors.configuration?.organization.message
                          : "Enter project for the workspace"
                      }
                    />
                  )}
                />
              )}

              {selectedOrg && (
                <>
                  {selectedProvider === "github" && (
                    <Controller
                      name="configuration"
                      control={control}
                      render={({ field }) => (
                        <GithubRepos
                          ikApi={ikApi}
                          buffer={buffer}
                          org={selectedOrg}
                          queryParams={{
                            integration_id: getValues("integrationId"),
                          }}
                          setBuffer={setBuffer}
                          {...field}
                          error={!!errors.configuration}
                          helpertext={
                            errors.configuration
                              ? errors.configuration.message
                              : "Select github_repo for the workspace"
                          }
                          value={field.value}
                          label="Select Repository"
                        />
                      )}
                    />
                  )}
                  {selectedProvider === "bitbucket" && (
                    <Controller
                      name="configuration"
                      control={control}
                      render={({ field }) => (
                        <BitbucketRepos
                          ikApi={ikApi}
                          buffer={buffer}
                          org={selectedOrg}
                          setBuffer={setBuffer}
                          queryParams={{
                            integration_id: getValues("integrationId"),
                          }}
                          {...field}
                          error={!!errors.configuration?.repo}
                          helpertext={
                            errors.configuration?.repo
                              ? errors.configuration?.repo.message
                              : "Select bitbucket_repo for the workspace"
                          }
                          value={field.value}
                          label="Select Repository"
                        />
                      )}
                    />
                  )}
                  {selectedProvider === "azure_devops" && (
                    <Controller
                      name="configuration"
                      control={control}
                      render={({ field }) => (
                        <AzureDevopsRepos
                          ikApi={ikApi}
                          buffer={buffer}
                          project={selectedOrg}
                          setBuffer={setBuffer}
                          queryParams={{
                            integration_id: getValues("integrationId"),
                          }}
                          {...field}
                          error={!!errors.configuration?.repo}
                          helpertext={
                            errors.configuration?.repo
                              ? errors.configuration?.repo.message
                              : "Select AzureDevops Repo for the workspace"
                          }
                          value={field.value}
                          label="Select Repository"
                        />
                      )}
                    />
                  )}
                </>
              )}
            </Box>
          </PropertyCard>
        )}
      </Box>
    </PageContainer>
  );
};

const WorkspaceCreatePage = () => {
  const methods = useForm<WorkspaceCreate>({
    defaultValues: {
      name: "",
      description: "",
      integrationId: "",
      labels: [],
      workspaceProvider: "",
      configuration: {},
    },
    mode: "onChange",
  });

  return (
    <FormProvider {...methods}>
      <WorkspaceCreatePageInner />
    </FormProvider>
  );
};

WorkspaceCreatePage.path = "/workspaces/create";

export { WorkspaceCreatePage };
