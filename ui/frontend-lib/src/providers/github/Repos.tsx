/* eslint-disable react/prop-types */
import { useEffect, forwardRef, useState, useCallback } from "react";

import { Box, Autocomplete, TextField, Typography } from "@mui/material";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import GradientCircularProgress from "../../common/GradientCircularProgress";
import { notifyError } from "../../common/hooks/useNotification";
import { IkEntity } from "../../types";

import { GithubRepo } from "./types";

interface GithubReposProps {
  ikApi: InfraKitchenApi;
  onChange: (selectedEntity: any) => void;
  org: string;
  value: any;
  label: string;
  error?: boolean;
  helpertext?: string;
  buffer: Record<string, IkEntity>;
  queryParams?: Record<string, any>;
  setBuffer: (selectedEntity: any) => void;
  [key: string]: any; // Allow additional props
}

const GithubRepos = forwardRef<any, GithubReposProps>((props, _ref) => {
  const {
    ikApi,
    onChange,
    setBuffer,
    org,
    buffer,
    value,
    label,
    helpertext,
    queryParams,
    error,
    ...otherProps
  } = props;
  const [isLoading, setIsLoading] = useState(false);
  const options = buffer["github_repos"] || [];

  const handleEntityChange = (_event: any, newValue: GithubRepo | null) => {
    const selectedItem =
      buffer["github_repos"]?.find(
        (e: GithubRepo) => e.name === newValue?.name,
      ) || null;
    onChange(selectedItem);
  };

  const getRepos = useCallback(async () => {
    if (!org) return;
    if (!buffer["github_repos"] || buffer["github_repos"].length === 0) {
      setIsLoading(true);
      try {
        const response: GithubRepo[] = await ikApi.get(
          `provider/github/${org}/repos`,
          queryParams,
        );
        setBuffer((prev: Record<string, GithubRepo[]>) => ({
          ...prev,
          ["github_repos"]: response,
        }));
      } catch (error: any) {
        notifyError(error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [ikApi, org, buffer, queryParams, setBuffer]);

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
          error={error}
          helperText={helpertext || ""}
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
      renderOption={(props, option) => {
        const { key, ...otherProps } = props;
        return (
          <li key={key} {...otherProps}>
            <Box>
              <Typography variant="body1">{option.name}</Typography>
              {option.description && (
                <Typography variant="body2" color="text.secondary">
                  {option.description}
                </Typography>
              )}
            </Box>
          </li>
        );
      }}
      noOptionsText={isLoading ? "Loading..." : "No repositories found"}
      disabled={isLoading}
      {...otherProps}
    />
  );
});

GithubRepos.displayName = "GithubRepos";
export default GithubRepos;
