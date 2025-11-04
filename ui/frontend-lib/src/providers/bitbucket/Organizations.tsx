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

import { BitbucketOrganization } from "./types";

interface BitbucketOrganizationsProps {
  ikApi: InfraKitchenApi;
  onChange: (selectedEntity: any) => void;
  value: any;
  label: string;
  error?: boolean;
  helpertext?: string;
  buffer: Record<string, IkEntity>;
  setBuffer: (selectedEntity: any) => void;
  queryParams?: Record<string, string>;
  [key: string]: any; // Allow additional props
}

const BitbucketOrganizations = forwardRef<any, BitbucketOrganizationsProps>(
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
        buffer["bitbucket_organizations"]?.find(
          (e: BitbucketOrganization) => e.slug === selectedId,
        ) || null;
      onChange(selectedItem?.slug);
    };

    const getOrganizarions = useCallback(async () => {
      if (
        !buffer["bitbucket_organizations"] ||
        buffer["bitbucket_organizations"].length === 0
      ) {
        try {
          const response: BitbucketOrganization[] = await ikApi.get(
            `provider/bitbucket/organizations`,
            queryParams,
          );
          setBuffer((prev: Record<string, BitbucketOrganization[]>) => ({
            ...prev,
            ["bitbucket_organizations"]: response,
          }));
        } catch (error: any) {
          notifyError(error);
        }
      }
    }, [ikApi, setBuffer, buffer, queryParams]);

    useEffect(() => {
      getOrganizarions();
    }, [getOrganizarions]);

    return (
      <FormControl fullWidth margin="normal">
        <InputLabel id="bitbucket-org-select-label">{props.label}</InputLabel>
        <Select
          labelId="bitbucket-org-select-label"
          id="bitbucket-org-select"
          value={
            buffer["bitbucket_organizations"] &&
            buffer["bitbucket_organizations"].some(
              (option: BitbucketOrganization) => option.slug === value,
            )
              ? value
              : ""
          }
          onChange={handleEntityChange}
          {...otherProps}
        >
          {buffer["bitbucket_organizations"] &&
            buffer["bitbucket_organizations"].map(
              (e: BitbucketOrganization) => (
                <MenuItem key={e.slug} value={e.slug}>
                  {e.name}
                </MenuItem>
              ),
            )}
        </Select>
        <FormHelperText error={props.error}>
          {props.helpertext || ""}
        </FormHelperText>
      </FormControl>
    );
  },
);

BitbucketOrganizations.displayName = "bitbucketOrganizations";
export default BitbucketOrganizations;
