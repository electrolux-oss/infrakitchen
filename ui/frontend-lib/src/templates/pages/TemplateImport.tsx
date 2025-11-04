import { useCallback, useState } from "react";

import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import {
  Box,
  MenuItem,
  TextField,
  Button,
  Autocomplete,
  Chip,
} from "@mui/material";

import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { IkEntity } from "../../types";
import { TemplateImportRequest, TemplateResponse } from "../types";

export const TemplateImportPage = () => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TemplateImportRequest>({
    mode: "onChange",
    defaultValues: {
      name: "",
      description: "",
      source_code_folder: "/",
      source_code_branch: "main",
      source_code_url: "",
      source_code_language: "opentofu",
      labels: [],
      integration_id: "",
      parents: [],
    },
  });

  const sourceCodeLanguages = ["opentofu"];
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const onSubmit = useCallback(
    (data: TemplateImportRequest) => {
      setIsSubmitting(true);
      ikApi
        .postRaw("use_cases/create_template_with_scv", data)
        .then((response: TemplateResponse) => {
          setIsSubmitting(false);
          if (response.id) {
            notify(
              "Template import initiated. It may take a few minutes to complete.",
              "info",
            );
            navigate(`${linkPrefix}templates/${response.id}`);
          }
        })
        .catch((error: any) => {
          notifyError(error);
          setIsSubmitting(false);
        });
    },
    [ikApi, navigate, linkPrefix],
  );

  const handleBack = () => navigate(`${linkPrefix}templates`);

  return (
    <PageContainer
      title="Import Template from Repository"
      onBack={handleBack}
      backAriaLabel="Back to templates"
      bottomActions={
        <>
          <Button variant="outlined" color="primary" onClick={handleBack}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Importing..." : "Import"}
          </Button>
        </>
      }
    >
      <PropertyCard title="Template Source Configuration">
        <Box>
          <Controller
            name="source_code_language"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                id="source_code_language"
                label="Template Type"
                required
                select
                fullWidth
                disabled
                margin="normal"
                error={!!errors.source_code_language}
                helperText={errors.source_code_language?.message}
                slotProps={{
                  select: {
                    inputProps: {
                      "aria-label": "Template Type",
                      id: "source_code_language",
                    },
                  },
                }}
              >
                {sourceCodeLanguages.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Controller
            name="integration_id"
            control={control}
            render={({ field }) => (
              <ReferenceInput
                label="Git Integration"
                required
                ikApi={ikApi}
                buffer={buffer}
                setBuffer={setBuffer}
                {...field}
                entity_name="integrations"
                filter={{ integration_type: "git" }}
                showFields={["integration_provider", "name"]}
                error={!!errors.integration_id}
                helpertext={
                  errors.integration_id
                    ? errors.integration_id.message
                    : "Select Git Integration"
                }
                value={field.value}
              />
            )}
          />
          <Controller
            name="source_code_url"
            control={control}
            rules={{
              required: "Repository URL is required",
              pattern: {
                value: /^(https?:\/\/|git@)/,
                message:
                  "Please enter a valid repository URL (e.g., https://github.com/terraform-aws-modules/terraform-aws-eks)",
              },
            }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Repository URL"
                required
                error={!!errors.source_code_url}
                placeholder="Enter repository URL"
                type="url"
                helperText={
                  errors.source_code_url ? errors.source_code_url.message : ""
                }
                fullWidth
                margin="normal"
              />
            )}
          />
          <Controller
            name="source_code_folder"
            control={control}
            rules={{ required: "Directory path is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Directory Path"
                required
                error={!!errors.source_code_folder}
                placeholder="Enter directory path"
                helperText={
                  errors.source_code_folder
                    ? errors.source_code_folder.message
                    : ""
                }
                fullWidth
                margin="normal"
              />
            )}
          />
          <Controller
            name="source_code_branch"
            control={control}
            rules={{ required: "Branch name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Branch"
                required
                error={!!errors.source_code_branch}
                placeholder="Enter branch name"
                helperText={
                  errors.source_code_branch
                    ? errors.source_code_branch.message
                    : ""
                }
                fullWidth
                margin="normal"
              />
            )}
          />
          <Controller
            name="parents"
            control={control}
            render={({ field }) => (
              <ArrayReferenceInput
                ikApi={ikApi}
                buffer={buffer}
                setBuffer={setBuffer}
                {...field}
                entity_name="templates"
                error={!!errors.parents}
                helpertext={
                  errors.parents ? errors.parents.message : "Parent templates"
                }
                value={field.value}
                label="Select Parents"
                multiple
              />
            )}
          />
        </Box>
      </PropertyCard>

      <PropertyCard title="Template Metadata">
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
                error={!!errors.name}
                placeholder="Enter template name"
                helperText={errors.name ? errors.name.message : ""}
                fullWidth
                margin="normal"
              />
            )}
          />
          <Controller
            name="labels"
            control={control}
            defaultValue={[]}
            render={({ field }) => (
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={field.value}
                onChange={(_event, newValue) => field.onChange(newValue)}
                renderValue={(value: readonly string[], getTagProps) =>
                  value.map((option: string, index: number) => {
                    const { key, ...rest } = getTagProps({ index });
                    return (
                      <Chip
                        key={key}
                        {...rest}
                        variant="outlined"
                        label={option}
                      />
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Labels"
                    error={!!errors.labels}
                    helperText={
                      errors.labels
                        ? errors.labels.message
                        : "Add labels and press Enter"
                    }
                    fullWidth
                    margin="normal"
                  />
                )}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                id="description"
                label="Description"
                error={!!errors.description}
                helperText={
                  errors.description ? errors.description.message : ""
                }
                fullWidth
                placeholder="Enter a description for this template"
                multiline
                margin="normal"
                slotProps={{
                  htmlInput: {
                    "aria-label": "Template description",
                    id: "description",
                  },
                }}
              />
            )}
          />
        </Box>
      </PropertyCard>
    </PageContainer>
  );
};

TemplateImportPage.path = "/templates/import";
