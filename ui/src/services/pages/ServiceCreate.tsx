import { useCallback, useEffect, useState } from "react";

import { Controller, useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";

import { LabelInput, MultiSelectEditor } from "../../common";
import { PropertyCard } from "../../common/components/cards/PropertyCard";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { IkEntity } from "../../types";
import { Button, TextField } from "../../ui";
import { GqlUserShort, USERS_SHORT_QUERY } from "../../users/graphql";
import { CREATE_SERVICE_MUTATION } from "../graphql";
import { ServiceCreateRequest } from "../types";

type UserOption = GqlUserShort & { displayName?: string | null };

const getUserLabel = (user: UserOption) => user.displayName || user.identifier;

export const ServiceCreatePage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const presetProjectId = searchParams.get("project_id");

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ServiceCreateRequest>({
    defaultValues: {
      name: "",
      description: "",
      projectId: presetProjectId ?? "",
      repositoryUrl: "",
      repositoryIntegrationId: null,
      labels: [],
      owners: [],
    },
    mode: "onChange",
  });

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const watchedRepositoryUrl = watch("repositoryUrl");
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
    async (data: ServiceCreateRequest) => {
      try {
        const response = await ikApi.graphqlRequest<{
          createService: {
            id: string;
            name: string;
          };
        }>(CREATE_SERVICE_MUTATION, {
          input: {
            ...data,
            repositoryUrl: data.repositoryUrl?.trim() || null,
            repositoryIntegrationId: data.repositoryUrl?.trim()
              ? data.repositoryIntegrationId
              : null,
          },
        });

        const createdService = response.createService;
        if (createdService?.id) {
          notify("Service created successfully", "success");
          navigate(`${linkPrefix}services/${createdService.id}`);
        }
      } catch (error: any) {
        notifyError(error);
      }
    },
    [ikApi, navigate, linkPrefix],
  );

  return (
    <PageContainer
      title="Create Service"
      bottomActions={
        <>
          <Button onClick={() => navigate(`${linkPrefix}services`)}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit(onSubmit)}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex w-full min-w-80 flex-col items-center">
        <PropertyCard title="Service Definition">
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
                    errors.name
                      ? errors.name.message
                      : "Unique within the project"
                  }
                  fullWidth
                  margin="normal"
                  inputProps={{ "aria-label": "Service name" }}
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
                      : "Short summary of what this service does"
                  }
                  fullWidth
                  margin="normal"
                  inputProps={{ "aria-label": "Service description" }}
                />
              )}
            />
            <Controller
              name="projectId"
              control={control}
              rules={{ required: "Project is required" }}
              render={({ field }) => (
                <ReferenceInput
                  ikApi={ikApi}
                  buffer={buffer}
                  setBuffer={setBuffer}
                  {...field}
                  entity_name="projects"
                  showFields={["name"]}
                  error={!!errors.projectId}
                  helpertext={
                    errors.projectId
                      ? errors.projectId.message
                      : "The project this service belongs to"
                  }
                  value={field.value}
                  label="Select Project"
                />
              )}
            />
            <Controller
              name="repositoryUrl"
              control={control}
              rules={{
                pattern: {
                  value: /^(https?:\/\/|ssh:\/\/|[^@\s/]+@[^:\s]+:)\S+$/,
                  message:
                    "Use a git URL like https://github.com/org/repo or git@github.com:org/repo.git",
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  label="Repository URL"
                  placeholder="git@github.com:org/repo.git"
                  error={!!errors.repositoryUrl}
                  helperText={
                    errors.repositoryUrl
                      ? errors.repositoryUrl.message
                      : "Where the service's code lives. It is linked if already imported, otherwise imported and synced."
                  }
                  fullWidth
                  margin="normal"
                  inputProps={{ "aria-label": "Repository URL" }}
                />
              )}
            />
            {watchedRepositoryUrl && (
              <Controller
                name="repositoryIntegrationId"
                control={control}
                render={({ field }) => (
                  <ReferenceInput
                    ikApi={ikApi}
                    buffer={buffer}
                    setBuffer={setBuffer}
                    {...field}
                    entity_name="integrations"
                    filter={{ integration_type: "git" }}
                    helpertext="Optional. Leave empty to use the only integration for this host, or none for a public HTTPS repository."
                    value={field.value}
                    label="Git Integration"
                  />
                )}
              />
            )}
            <Controller
              name="labels"
              control={control}
              defaultValue={[]}
              render={({ field }) => <LabelInput errors={errors} {...field} />}
            />
          </div>
        </PropertyCard>

        <PropertyCard title="Service Owners">
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
                  helperText="Users allowed to edit this service. Project owners can always edit it."
                  options={users}
                  getOptionLabel={getUserLabel}
                />
              )}
            />
          </div>
        </PropertyCard>
      </div>
    </PageContainer>
  );
};

ServiceCreatePage.path = "services/create";
