import React, { useEffect, forwardRef, useState } from "react";

import {
  FormControl,
  FormHelperText,
  Autocomplete,
  TextField,
} from "@mui/material";

import { InfraKitchenApi } from "../../../api/InfraKitchenApi";
import { IkEntity } from "../../../types";
import { notifyError } from "../../hooks/useNotification";

import { getOptionLabel } from "./utils";

interface ReferenceInputProps {
  ikApi: InfraKitchenApi;
  entity_name: string;
  onChange: (selectedEntity: any) => void;
  filter?: object;
  value: any;
  label: string;
  error?: boolean;
  showFields?: Array<string>;
  helpertext?: string;
  buffer: Record<string, IkEntity>;
  setBuffer: (selectedEntity: any) => void;
  [key: string]: any; // Allow additional props
}

const ReferenceInput = forwardRef<any, ReferenceInputProps>((props, _ref) => {
  const {
    ikApi,
    onChange,
    setBuffer,
    buffer,
    entity_name,
    filter = {},
    showFields = ["name"],
    value,
    ...otherProps
  } = props;

  const options: IkEntity[] = buffer[entity_name] || [];
  const [warning, setWarning] = useState<string | null>(null);

  const selectedOption = options.find((option) => option.id === value) || null;

  const handleAutocompleteChange = (
    event: React.SyntheticEvent,
    newValue: IkEntity | null,
  ) => {
    onChange(newValue ? newValue.id : null);
  };

  const isOptionDisabled = (option: IkEntity) => option.status === "disabled";

  useEffect(() => {
    if (otherProps.disabled) {
      return;
    }
    if (!filter) {
      setBuffer((prev: Record<string, IkEntity[]>) => ({
        ...prev,
        [entity_name]: [],
      }));
      return;
    }
    ikApi
      .getList(entity_name, {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "name", order: "ASC" },
        filter: filter,
      })
      .then((response: { data: IkEntity[] }) => {
        if (response.data.length === 0 && otherProps.required === true) {
          setWarning(
            `No available options for the required field "${props.label}". You need to create them first.`,
          );
        }

        setBuffer((prev: Record<string, IkEntity[]>) => ({
          ...prev,
          [entity_name]: response.data,
        }));
      })
      .catch((error: { message: string }) => {
        notifyError(error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter), entity_name, ikApi, setBuffer]);

  return (
    <FormControl fullWidth margin="normal">
      <Autocomplete
        readOnly={otherProps.readOnly}
        disabled={otherProps.disabled}
        value={selectedOption}
        options={options}
        getOptionLabel={(option) => getOptionLabel(option, showFields)}
        renderOption={(renderProps, option) => (
          <li {...renderProps} key={option.id}>
            {getOptionLabel(option, showFields)}
          </li>
        )}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        disableClearable={false}
        getOptionDisabled={isOptionDisabled}
        onChange={handleAutocompleteChange}
        renderValue={(option) => {
          return `${option.name || option.identifier}`;
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            {...otherProps}
            label={props.label}
            error={props.error}
          />
        )}
      />
      <FormHelperText error={props.error}>
        {props.helpertext || ""}
      </FormHelperText>
      {warning && (
        <FormHelperText sx={{ color: "warning.main" }}>
          {warning}
        </FormHelperText>
      )}
    </FormControl>
  );
});

ReferenceInput.displayName = "ReferenceInput";
export default ReferenceInput;
