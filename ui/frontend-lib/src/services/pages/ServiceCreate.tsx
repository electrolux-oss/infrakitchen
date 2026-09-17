import { useCallback, useEffect, useState } from "react";

import { Controller, useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";

import { Box, Button, TextField } from "@mui/material";

import { LabelInput, MultiSelectEditor } from "../../common";
import { PropertyCard } from "../../common/components/cards/PropertyCard";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { IkEntity } from "../../types";
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
    formState: { errors },
  } = useForm<ServiceCreateRequest>({
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      projectId: presetProjectId ?? "",
      repositoryUrl: "",
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
    async (data: ServiceCreateRequest) => {
      try {
        const response = await ikApi.graphqlRequest<{
          createService: {
            id: string;
            name: string;
          };
        }>(CREATE_SERVICE_MUTATION, { input: data });

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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          width: "100%",
          minWidth: 320,
        }}
      >
        <PropertyCard title="Service Definition">
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
                    errors.name
                      ? errors.name.message
                      : "Unique within the project"
                  }
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Service name",
                    },
                  }}
                />
              )}
            />
            <Controller
              name="displayName"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  label="Display Name"
                  variant="outlined"
                  helperText="Optional human-friendly name"
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Service display name",
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
                      : "Short summary of what this service does"
                  }
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Service description",
                    },
                  }}
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
                  value: /^https?:\/\/\S+$/,
                  message: "Must be a URL starting with https:// or http://",
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  label="Repository URL"
                  variant="outlined"
                  placeholder="https://github.com/org/repo"
                  error={!!errors.repositoryUrl}
                  helperText={
                    errors.repositoryUrl
                      ? errors.repositoryUrl.message
                      : "Where this service's source code lives"
                  }
                  fullWidth
                  margin="normal"
                  slotProps={{
                    htmlInput: {
                      "aria-label": "Service repository URL",
                    },
                  }}
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

        <PropertyCard title="Service Owners">
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
                  helperText="Users allowed to edit this service. Project owners can always edit it."
                  options={users}
                  getOptionLabel={getUserLabel}
                />
              )}
            />
          </Box>
        </PropertyCard>
      </Box>
    </PageContainer>
  );
};

ServiceCreatePage.path = "services/create";
