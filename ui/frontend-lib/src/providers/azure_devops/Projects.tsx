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

import { AzureDevopsProject } from "./types";

interface AzureDevopsProjectsProps {
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

const AzureDevopsProjects = forwardRef<any, AzureDevopsProjectsProps>(
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
        buffer["azure_devops_projects"]?.find(
          (e: AzureDevopsProject) => e.id === selectedId,
        ) || null;
      onChange(selectedItem?.id);
    };

    const getProjects = useCallback(async () => {
      if (
        !buffer["azure_devops_projects"] ||
        buffer["azure_devops_projects"].length === 0
      ) {
        try {
          const response: AzureDevopsProject[] = await ikApi.get(
            `provider/azure_devops/projects`,
            queryParams,
          );
          setBuffer((prev: Record<string, AzureDevopsProject[]>) => ({
            ...prev,
            ["azure_devops_projects"]: response,
          }));
        } catch (error: any) {
          notifyError(error);
        }
      }
    }, [ikApi, setBuffer, buffer, queryParams]);

    useEffect(() => {
      getProjects();
    }, [getProjects]);

    return (
      <FormControl fullWidth margin="normal">
        <InputLabel id="azure-devops-proj-select-label">
          {props.label}
        </InputLabel>
        <Select
          labelId="azure-devops-proj-select-label"
          id="azure-devops-proj-select"
          value={
            buffer["azure_devops_projects"] &&
            buffer["azure_devops_projects"].some(
              (option: AzureDevopsProject) => option.id === value,
            )
              ? value
              : ""
          }
          onChange={handleEntityChange}
          {...otherProps}
        >
          {buffer["azure_devops_projects"] &&
            buffer["azure_devops_projects"].map((e: AzureDevopsProject) => (
              <MenuItem key={e.id} value={e.id}>
                {e.name} {e.description ? `(${e.description})` : ""}
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

AzureDevopsProjects.displayName = "AzureDevopsProjects";
export default AzureDevopsProjects;
