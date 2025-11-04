import { useEffect, forwardRef, useCallback } from "react";

import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  SelectChangeEvent,
} from "@mui/material";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import { notifyError } from "../../common/hooks/useNotification";
import { IkEntity } from "../../types";

import { GithubOrganization } from "./types";

interface GithubOrganizationsProps {
  ikApi: InfraKitchenApi;
  onChange: (selectedEntity: any) => void;
  value: any;
  label: string;
  error?: boolean;
  helpertext?: string;
  buffer: Record<string, IkEntity>;
  queryParams?: Record<string, any>;
  setBuffer: (selectedEntity: any) => void;
  [key: string]: any; // Allow additional props
}

const GithubOrganizations = forwardRef<any, GithubOrganizationsProps>(
  (props, _ref) => {
    const {
      ikApi,
      onChange,
      setBuffer,
      buffer,
      value,
      queryParams,
      ...otherProps
    } = props;

    const handleEntityChange = (event: SelectChangeEvent<any>) => {
      const selectedId = event.target.value as string;
      const selectedItem =
        buffer["github_organizations"]?.find(
          (e: GithubOrganization) => e.login === selectedId,
        ) || null;
      onChange(selectedItem?.login);
    };

    const getOrganizarions = useCallback(async () => {
      if (
        !buffer["github_organizations"] ||
        buffer["github_organizations"].length === 0
      ) {
        try {
          const response: GithubOrganization[] = await ikApi.get(
            `provider/github/organizations`,
            queryParams,
          );
          setBuffer((prev: Record<string, GithubOrganization[]>) => ({
            ...prev,
            ["github_organizations"]: response,
          }));
        } catch (error: any) {
          notifyError(error);
        }
      }
    }, [ikApi, setBuffer, queryParams, buffer]);

    useEffect(() => {
      getOrganizarions();
    }, [getOrganizarions]);

    return (
      <FormControl fullWidth margin="normal">
        <InputLabel id="github-org-select-label">{props.label}</InputLabel>
        <Select
          labelId="github-org-select-label"
          id="github-org-select"
          value={
            buffer["github_organizations"] &&
            buffer["github_organizations"].some(
              (option: GithubOrganization) => option.login === value,
            )
              ? value
              : ""
          }
          onChange={handleEntityChange}
          {...otherProps}
        >
          {buffer["github_organizations"] &&
            buffer["github_organizations"].map((e: GithubOrganization) => (
              <MenuItem key={e.login} value={e.login}>
                {e.login} {e.description ? `(${e.description})` : ""}
              </MenuItem>
            ))}
        </Select>
        <FormHelperText error={props.error}>
          {props.helpertext || ""}
        </FormHelperText>
      </FormControl>
    );
  },
);

GithubOrganizations.displayName = "GithubOrganizations";
export default GithubOrganizations;
