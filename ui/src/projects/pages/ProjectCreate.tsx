import { useCallback, useEffect, useState } from "react";

import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { LabelInput, MultiSelectEditor } from "../../common";
import { PropertyCard } from "../../common/components/cards/PropertyCard";
import { FieldInfo } from "../../common/components/fields/FieldInfo";
import { DependencyConfigurationFields } from "../../common/components/hcl/DependencyConfigurationFields";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { validateTagEntries } from "../../resources/utils/formValidation";
import { IkEntity } from "../../types";
import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  MenuItem,
  Select,
  Button,
  Switch,
  TextField,
} from "../../ui";
import { GqlUserShort, USERS_SHORT_QUERY } from "../../users/graphql";
import {
  DRIFT_DETECTION_OPTIONS,
  DriftDetectionMode,
  fromDriftDetectionMode,
  RESOURCE_UPDATE_APPROVAL_BYPASS_FIELD_OPTIONS,
  toDriftDetectionMode,
} from "../constants";
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
        drift_detection: null,
        allow_unapproved_metadata_edits: [],
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
      bottomActions={
        <>
          <Button onClick={() => navigate(`${linkPrefix}projects`)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit(onSubmit)}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex w-full min-w-80 flex-col items-center">
        <PropertyCard title="Project Definition">
          <div>
            <Controller
              name="name"
              control={control}
              rules={{ required: "Name is required" }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  required
                  error={!!errors.name}
                  helperText={
                    errors.name ? errors.name.message : "Name of the project"
                  }
                  fullWidth
                  margin="normal"
                  inputProps={{ "aria-label": "Project name" }}
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
                  error={!!errors.description}
                  helperText={
                    errors.description
                      ? errors.description.message
                      : "Short summary of the project"
                  }
                  fullWidth
                  margin="normal"
                  inputProps={{ "aria-label": "Project description" }}
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
          </div>
        </PropertyCard>

        <PropertyCard title="Project Configuration">
          <div>
            <Controller
              name="configuration.always_use_workspace"
              control={control}
              render={({ field }) => (
                <div className="flex items-center gap-1">
                  <FormControlLabel
                    className="mr-0 -ml-[3.5px]"
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label="Always use workspace"
                  />
                  <FieldInfo text="Force resources in this project to use the assigned workspace." />
                </div>
              )}
            />
            <Controller
              name="configuration.drift_detection"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth margin="normal">
                  <FormLabel>Drift detection</FormLabel>
                  <Select
                    value={toDriftDetectionMode(field.value)}
                    variant="outlined"
                    onChange={(e) =>
                      field.onChange(
                        fromDriftDetectionMode(
                          e.target.value as DriftDetectionMode,
                        ),
                      )
                    }
                  >
                    {DRIFT_DETECTION_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    Regularly check the resources of this project for drift. The
                    global setting is used unless turned on or off here.
                  </FormHelperText>
                </FormControl>
              )}
            />
            <Controller
              name="configuration.allow_unapproved_metadata_edits"
              control={control}
              render={({ field }) => (
                <div className="mt-4">
                  <div className="mb-1 flex items-center gap-1">
                    <span className="text-body2 font-medium">
                      Fields editable without approval
                    </span>
                    <FieldInfo text="Users can update these resource fields without creating an approval request." />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {RESOURCE_UPDATE_APPROVAL_BYPASS_FIELD_OPTIONS.map(
                      (option) => (
                        <FormControlLabel
                          key={option.value}
                          className="-ml-[3.5px]"
                          control={
                            <Switch
                              checked={(field.value || []).includes(
                                option.value,
                              )}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.checked
                                    ? [...(field.value || []), option.value]
                                    : (field.value || []).filter(
                                        (item) => item !== option.value,
                                      ),
                                )
                              }
                            />
                          }
                          label={option.label}
                        />
                      ),
                    )}
                  </div>
                </div>
              )}
            />
          </div>
        </PropertyCard>

        <PropertyCard title="Project Owners">
          <div>
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
          </div>
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
      </div>
    </PageContainer>
  );
};

ProjectCreatePage.path = "projects/create";
