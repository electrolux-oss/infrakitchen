import { useCallback, useEffect, useState } from "react";

import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";

import { LabelInput, MultiSelectEditor } from "../../common";
import { DependencyConfigurationFields } from "../../common/components/DependencyConfigurationFields";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { validateTagEntries } from "../../resources/utils/formValidation";
import { IkEntity } from "../../types";
import { GqlUserShort, USERS_SHORT_QUERY } from "../../users/graphql";
import { CREATE_PROJECT_MUTATION } from "../graphql";
import { ProjectCreateRequest } from "../types";

type UserOption = GqlUserShort & { displayName?: string | null };

const getUserLabel = (user: UserOption) => user.displayName || user.identifier;

export const ProjectCreatePage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectCreateRequest>({
    defaultValues: {
      name: "",
      description: "",
      workspaceId: null,
      configuration: {
        always_use_workspace: false,
      },
      dependencyTags: [],
      dependencyConfig: [],
      labels: [],
      owners: [],
    },
    mode: "onChange",
  });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await ikApi.graphqlRequest<{ users: UserOption[] }>(
          USERS_SHORT_QUERY,
          {
            sort: ["identifier", "ASC"],
            range: [0, 999],
          },
        );
        setUsers(response.users || []);
      } catch (error: any) {
        notifyError(error);
      }
    };

    loadUsers();
  }, [ikApi]);

  const onSubmit = useCallback(
    async (data: ProjectCreateRequest) => {
      try {
        const response = await ikApi.graphqlRequest<{
          createProject: {
            id: string;
            name: string;
          };
        }>(CREATE_PROJECT_MUTATION, { input: data });

        const createdProject = response.createProject;
        if (createdProject?.id) {
          notify("Project created successfully", "success");
          navigate(`${linkPrefix}projects/${createdProject.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, navigate, linkPrefix],
  );

  return (
    <PageContainer
      title="Create Project"
      onBack={() => navigate(`${linkPrefix}projects`)}
      backAriaLabel="Back to projects"
      bottomActions={
        <>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}projects`)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(onSubmit)}
          >
            Save
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
        <PropertyCard title="Project Definition">
          <Box>
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  required
                  variant="outlined"
                  error={!!errors.name}
                  helperText={
                    errors.name ? errors.name.message : "Name of the project"
                  }
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Project name",
                    },
                  }}
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
                  variant="outlined"
                  error={!!errors.description}
                  helperText={
                    errors.description
                      ? errors.description.message
                      : "Short summary of the project"
                  }
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Project description",
                    },
                  }}
                />
              )}
            />
            <Controller
              name="workspaceId"
              control={control}
              render={({ field }) => (
                <ReferenceInput
                  ikApi={ikApi}
                  buffer={buffer}
                  setBuffer={setBuffer}
                  {...field}
                  entity_name="workspaces"
                  showFields={["name", "workspace_provider"]}
                  error={!!errors.workspaceId}
                  helpertext={
                    errors.workspaceId
                      ? errors.workspaceId.message
                      : "Optional workspace for this project"
                  }
                  value={field.value}
                  label="Select Workspace"
                />
              )}
            />
            <Controller
              name="labels"
              control={control}
              defaultValue={[]}
              render={({ field }) => <LabelInput errors={errors} {...field} />}
            />
          </Box>
        </PropertyCard>

        <PropertyCard title="Project Configuration">
          <Box>
            <Controller
              name="configuration.always_use_workspace"
              control={control}
              render={({ field }) => (
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label="Always use workspace"
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: -1, mb: 1 }}
                  >
                    Force resources in this project to use the assigned
                    workspace.
                  </Typography>
                </Box>
              )}
            />
          </Box>
        </PropertyCard>

        <PropertyCard title="Project Owners">
          <Box>
            <Controller
              name="owners"
              control={control}
              render={({ field }) => (
                <MultiSelectEditor<UserOption>
                  value={users.filter((user) => field.value.includes(user.id))}
                  onChange={(value) =>
                    field.onChange(value.map((user) => user.id))
                  }
                  label="Assigned Users"
                  helperText="Optional users allowed to edit this project"
                  options={users}
                  getOptionLabel={getUserLabel}
                />
              )}
            />
          </Box>
        </PropertyCard>

        <DependencyConfigurationFields
          control={control}
          errors={errors}
          dependencyTagsName="dependencyTags"
          dependencyConfigName="dependencyConfig"
          dependencyTagsRules={{
            validate: {
              requiredFields: (value) => validateTagEntries(value),
            },
          }}
          dependencyConfigRules={{
            validate: {
              requiredFields: (value) => validateTagEntries(value),
            },
          }}
        />
      </Box>
    </PageContainer>
  );
};

ProjectCreatePage.path = "projects/create";
