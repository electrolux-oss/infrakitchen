import { useEffect, forwardRef, useState, useCallback } from "react";

import { Box, Autocomplete, TextField, Typography } from "@mui/material";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import GradientCircularProgress from "../../common/GradientCircularProgress";
import { notifyError } from "../../common/hooks/useNotification";
import { IkEntity } from "../../types";

import { BitbucketRepo } from "./types";

interface BitbucketReposProps {
  ikApi: InfraKitchenApi;
  onChange: (selectedEntity: any) => void;
  org: string;
  value: any;
  label: string;
  error?: boolean;
  helpertext?: string;
  buffer: Record<string, IkEntity>;
  queryParams?: Record<string, string>;
  setBuffer: (selectedEntity: any) => void;
  [key: string]: any; // Allow additional props
}

const BitbucketRepos = forwardRef<any, BitbucketReposProps>((props, _ref) => {
  const {
    ikApi,
    onChange,
    setBuffer,
    org,
    label,
    buffer,
    value,
    helpertext,
    queryParams,
    ...otherProps
  } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<Error | null>(null);

  const options = buffer["bitbucket_repos"] || [];

  const handleEntityChange = (_event: any, newValue: BitbucketRepo | null) => {
    const selectedItem =
      buffer["bitbucket_repos"]?.find(
        (e: BitbucketRepo) => e.name === newValue?.name,
      ) || null;
    onChange(selectedItem);
  };

  const getRepos = useCallback(async () => {
    if (!org) return;
    if (!buffer["bitbucket_repos"] || buffer["bitbucket_repos"].length === 0) {
      setIsLoading(true);
      try {
        const response: BitbucketRepo[] = await ikApi.get(
          `provider/bitbucket/${org}/repos`,
          queryParams,
        );
        setBuffer((prev: Record<string, BitbucketRepo[]>) => ({
          ...prev,
          ["bitbucket_repos"]: response,
        }));
      } catch (error: any) {
        notifyError(error);
        setFetchError(new Error(error.message));
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
      renderOption={(props, option) => {
        const { ...otherProps } = props;
        return (
          <li {...otherProps}>
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
      disabled={isLoading || !!fetchError}
      {...otherProps}
    />
  );
});

BitbucketRepos.displayName = "BitbucketRepos";
export default BitbucketRepos;
