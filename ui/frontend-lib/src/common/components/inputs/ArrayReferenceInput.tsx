import React, { useEffect, forwardRef } from "react";

import {
  FormControl,
  Autocomplete,
  TextField,
  Chip,
  FormHelperText,
} from "@mui/material";

import { InfraKitchenApi } from "../../../api/InfraKitchenApi";
import { IkEntity } from "../../../types";
import { notifyError } from "../../hooks/useNotification";

import { getOptionLabel } from "./utils";

interface ArrayReferenceInputProps {
  ikApi: InfraKitchenApi;
  entity_name: string;
  onChange: (selectedEntity: any[]) => void;
  filter?: object;
  multiple?: boolean;
  helpertext?: string;
  buffer: Record<string, IkEntity[]>;
  showFields?: Array<string>;
  label: string;
  value: any;
  error?: boolean;
  setBuffer: (selectedEntity: any) => void;
  [key: string]: any; // Allow additional props
}

const ArrayReferenceInput = forwardRef<any, ArrayReferenceInputProps>(
  (props, _ref) => {
    const {
      ikApi,
      onChange,
      setBuffer,
      buffer,
      showFields = ["name"],
      entity_name,
      filter = {},
      label,
      value,
      ...otherProps
    } = props;

    const handleEntityChange = (
      _event: React.SyntheticEvent,
      value: IkEntity | IkEntity[] | null,
      _reason: string,
      _details?: any,
    ) => {
      if (Array.isArray(value)) {
        onChange(value.map((entity) => entity.id) || []);
      } else if (value && typeof value === "object") {
        onChange([value.id]);
      } else {
        onChange([]);
      }
    };

    const isOptionDisabled = (option: IkEntity) => option.status === "disabled";

    useEffect(() => {
      ikApi
        .getList(entity_name, {
          pagination: { page: 1, perPage: 100 },
          sort: { field: "name", order: "ASC" },
          filter: filter,
        })
        .then((response: { data: IkEntity[] }) => {
          setBuffer((prev: Record<string, IkEntity[]>) => ({
            ...prev,
            [entity_name]: response.data,
          }));
        })
        .catch((error: { message: string }) => {
          notifyError(error);
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(filter),
      ikApi,
      entity_name,
      setBuffer,
    ]);

    return (
      <FormControl fullWidth margin="normal">
        <Autocomplete
          sx={{
            "& .MuiOutlinedInput-root": {
              height: "auto",
              paddingTop: "6px",
              paddingBottom: "6px",
              alignItems: "flex-start",
            },
            "& .MuiAutocomplete-tagContainer": {
              flexWrap: "wrap",
              overflow: "visible",
              margin: "2px 0",
              padding: "0 2px",
            },
            "& .MuiAutocomplete-tag": {
              margin: "2px",
            },
          }}
          clearIcon={false}
          defaultValue={otherProps.defaultValue || undefined}
          disabled={otherProps.disabled || false}
          getOptionDisabled={isOptionDisabled}
          options={buffer[entity_name] || []}
          getOptionLabel={(option) => getOptionLabel(option, showFields)}
          isOptionEqualToValue={(option, value) =>
            option.id === (value?.id || value)
          }
          value={
            otherProps.multiple
              ? buffer[entity_name]?.filter((e: IkEntity) =>
                  value?.includes(e.id.toString()),
                ) || [] // Ensure array for multiple
              : buffer[entity_name]?.find(
                  (e: IkEntity) => e.id.toString() === value,
                ) || null // Ensure null for single select
          }
          multiple={otherProps.multiple || false}
          onChange={handleEntityChange}
          renderOption={(
            props: React.HTMLAttributes<HTMLLIElement> & { key: React.Key },
            option: IkEntity,
          ) => {
            const { key, ...rest } = props;
            return (
              <li key={key} {...rest}>
                {`${getOptionLabel(option, showFields)}`}
              </li>
            );
          }}
          renderValue={(value, getTagProps) => {
            const maxToShow = 5;
            const visible = value.slice(0, maxToShow);
            return [
              ...visible.map((option: IkEntity, index: number) => (
                <Chip
                  label={`${option.name || option.identifier}`}
                  {...getTagProps({ index })}
                  key={option.id}
                  size="small"
                  variant="outlined"
                />
              )),
              value.length > maxToShow ? (
                <Chip
                  label={`+${value.length - maxToShow}`}
                  {...getTagProps({ index: maxToShow })}
                  key="more"
                  size="small"
                  variant="outlined"
                />
              ) : null,
            ];
          }}
          renderInput={(params) => <TextField label={label} {...params} />}
        />

        <FormHelperText error={props.error}>
          {props.helpertext || ""}
        </FormHelperText>
      </FormControl>
    );
  },
);

ArrayReferenceInput.displayName = "ArrayReferenceInput";

export default ArrayReferenceInput;
