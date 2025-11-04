import { useEffect, forwardRef, useState, useCallback } from "react";

import { Box, Autocomplete, TextField, Typography } from "@mui/material";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import GradientCircularProgress from "../../common/GradientCircularProgress";
import { notifyError } from "../../common/hooks/useNotification";
import { IkEntity } from "../../types";

import { AzureDevopsRepo } from "./types";

interface AzureDevopsReposProps {
  ikApi: InfraKitchenApi;
  onChange: (selectedEntity: any) => void;
  project: string;
  value: any;
  label: string;
  error?: boolean;
  helpertext?: string;
  buffer: Record<string, IkEntity>;
  setBuffer: (selectedEntity: any) => void;
  queryParams?: Record<string, string>;
  [key: string]: any; // Allow additional props
}

const AzureDevopsRepos = forwardRef<any, AzureDevopsReposProps>(
  (props, _ref) => {
    const {
      ikApi,
      onChange,
      setBuffer,
      project,
      buffer,
      value,
      label,
      helpertext,
      queryParams,
      ...otherProps
    } = props;
    const [isLoading, setIsLoading] = useState(false);
    const options = buffer["azure_devops_repos"] || [];

    const [fetchError, setFetchError] = useState<Error | null>(null);

    const handleEntityChange = (
      _event: any,
      newValue: AzureDevopsRepo | null,
    ) => {
      const selectedItem =
        buffer["azure_devops_repos"]?.find(
          (e: AzureDevopsRepo) => e.name === newValue?.name,
        ) || null;
      onChange(selectedItem);
    };

    const getRepos = useCallback(async () => {
      if (!project) return;
      if (
        !buffer["azure_devops_repos"] ||
        buffer["azure_devops_repos"].length === 0
      ) {
        setIsLoading(true);
        try {
          const response: AzureDevopsRepo[] = await ikApi.get(
            `provider/azure_devops/${project}/repos`,
            queryParams,
          );
          setBuffer((prev: Record<string, AzureDevopsRepo[]>) => ({
            ...prev,
            ["azure_devops_repos"]: response,
          }));
        } catch (error: any) {
          notifyError(error);
          setFetchError(new Error(error.message));
        } finally {
          setIsLoading(false);
        }
      }
    }, [ikApi, project, buffer, setBuffer, queryParams]);

    useEffect(() => {
      getRepos();
    }, [getRepos]);

    return (
      <Autocomplete
        fullWidth
        options={options}
        loading={isLoading}
        value={value || null}
        onChange={handleEntityChange}
        getOptionLabel={(option) => option.name || ""}
        isOptionEqualToValue={(option, val) => option.uuid === val.uuid}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            margin="normal"
            error={!!fetchError}
            helperText={fetchError ? fetchError.message : helpertext || ""}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {isLoading ? <GradientCircularProgress /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <li {...props}>
            <Box>
              <Typography variant="body1">{option.name}</Typography>
              {option.description && (
                <Typography variant="body2" color="text.secondary">
                  {option.description}
                </Typography>
              )}
            </Box>
          </li>
        )}
        noOptionsText={isLoading ? "Loading..." : "No repositories found"}
        disabled={isLoading || !!fetchError}
        {...otherProps}
      />
    );
  },
);

AzureDevopsRepos.displayName = "AzureDevopsRepos";
export default AzureDevopsRepos;
