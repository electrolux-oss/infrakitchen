import { useCallback } from "react";

import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import {
  TextField,
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";
import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { BatchOperationEntitySelector } from "../components/BatchOperationEntitySelector";
import { BatchOperationCreate, BatchOperation } from "../types";

export const BatchOperationCreatePage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BatchOperationCreate>({
    defaultValues: {
      name: "",
      description: "",
      entity_type: "resource",
      entity_ids: [],
    },
    mode: "onChange",
  });

  const entityType = watch("entity_type");

  const onSubmit = useCallback(
    (data: BatchOperationCreate) => {
      ikApi
        .postRaw("batch_operations", data)
        .then((response: BatchOperation) => {
          if (response.id) {
            notify("Batch operation created successfully", "success");
            navigate(`${linkPrefix}batch_operations/${response.id}`);
          }
        })
        .catch((error: any) => {
          notifyError(error);
        });
    },
    [ikApi, navigate, linkPrefix],
  );

  return (
    <PageContainer
      title="Create Batch Operation"
      onBack={() => navigate(`${linkPrefix}batch_operations`)}
      backAriaLabel="Back to batch operations"
      bottomActions={
        <>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}batch_operations`)}
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
      <PropertyCard title="Batch Operation Configuration">
        <Box>
          <Controller
            name="name"
            control={control}
            rules={{ required: "Name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Name"
                variant="outlined"
                error={!!errors.name}
                helperText={
                  errors.name
                    ? errors.name.message
                    : "Name of the batch operation"
                }
                fullWidth
                margin="normal"
                slotProps={{
                  htmlInput: {
                    "aria-label": "Batch operation name",
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
                    : "Description of the batch operation"
                }
                fullWidth
                margin="normal"
                multiline
                rows={3}
                slotProps={{
                  htmlInput: {
                    "aria-label": "Batch operation description",
                  },
                }}
              />
            )}
          />
          <Controller
            name="entity_type"
            control={control}
            rules={{ required: "Entity type is required" }}
            render={({ field }) => (
              <FormControl
                fullWidth
                margin="normal"
                error={!!errors.entity_type}
              >
                <InputLabel id="entity-type-label">Entity Type</InputLabel>
                <Select
                  {...field}
                  labelId="entity-type-label"
                  label="Entity Type"
                  aria-label="Select entity type"
                >
                  <MenuItem value="resource">Resources</MenuItem>
                  <MenuItem value="executor">Executors</MenuItem>
                </Select>
                <FormHelperText>
                  {errors.entity_type
                    ? errors.entity_type.message
                    : "Type of entities to operate on"}
                </FormHelperText>
              </FormControl>
            )}
          />
          <BatchOperationEntitySelector
            control={control}
            errors={errors}
            entityType={entityType}
            setValue={setValue}
          />
        </Box>
      </PropertyCard>
    </PageContainer>
  );
};

BatchOperationCreatePage.path = "/batch_operations/create";
