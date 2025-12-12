import React, { useEffect, forwardRef, useState, useCallback } from "react";

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

interface ReferenceSearchInputProps {
  ikApi: InfraKitchenApi;
  entity_name: string;
  onChange: (selectedEntity: any) => void;
  searchField: string;
  filter?: object;
  value: any;
  label: string;
  error?: boolean;
  showFields?: Array<string>;
  helpertext?: string;
  buffer: Record<string, IkEntity>;
  setBuffer: (selectedEntity: any) => void;
  [key: string]: any;
}

const ReferenceSearchInput = forwardRef<any, ReferenceSearchInputProps>(
  (props, _ref) => {
    const {
      ikApi,
      onChange,
      entity_name,
      filter = {},
      showFields = ["name"],
      value,
      searchField,
      buffer,
      setBuffer,
      ...otherProps
    } = props;

    const [inputValue, setInputValue] = useState("");
    const [loading, setLoading] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);

    const [selectedOption, setSelectedOption] = useState<IkEntity | null>(null);
    const options: IkEntity[] = buffer[entity_name] || [];

    const handleAutocompleteChange = (
      event: React.SyntheticEvent,
      newValue: IkEntity | null,
    ) => {
      onChange(newValue ? newValue.id : null);
      setSelectedOption(newValue);
      setInputValue("");
    };

    const handleInputChange = (
      event: React.SyntheticEvent,
      newInputValue: string,
      reason: string,
    ) => {
      if (reason === "input") {
        setInputValue(newInputValue);
      } else if (reason === "clear") {
        setInputValue("");
      }
    };

    const isOptionDisabled = (option: IkEntity) => option.status === "disabled";

    const fetchOptions = useCallback(
      (inputSearchValue: string) => {
        if (otherProps.disabled) {
          return;
        }
        setLoading(true);

        // Construct the filter object for the API call
        // It includes the 'filter' prop and the live search term
        const apiFilter = {
          ...filter,
          [`${searchField}__like`]: inputSearchValue,
        };

        ikApi
          .getList(entity_name, {
            pagination: { page: 1, perPage: 100 },
            sort: { field: searchField, order: "ASC" },
            filter: apiFilter,
          })
          .then((response: { data: IkEntity[] }) => {
            if (
              response.data.length === 0 &&
              otherProps.required === true &&
              !inputSearchValue
            ) {
              setWarning(
                `No available options for the required field "${props.label}". You need to create them first.`,
              );
            } else {
              setWarning(null);
            }
            setBuffer((prev: Record<string, IkEntity[]>) => ({
              ...prev,
              [entity_name]: response.data,
            }));
          })
          .catch((error: { message: string }) => {
            notifyError(error);
          })
          .finally(() => {
            setLoading(false);
          });
      },
      [
        filter,
        entity_name,
        ikApi,
        props.label,
        otherProps.disabled,
        otherProps.required,
        searchField,
        setBuffer,
      ],
    );

    useEffect(() => {
      // If there's an ID but no corresponding selected object (and we are not currently loading options)
      if (value && !selectedOption) {
        ikApi
          .get(`${entity_name}/${value}`)
          .then((response: IkEntity) => {
            setSelectedOption(response);
            setBuffer((prev: Record<string, IkEntity[]>) => {
              const existingOptions = prev[entity_name] || [];
              // Avoid duplicates
              const isAlreadyInOptions = existingOptions.some(
                (option) => option.id === response.id,
              );
              return {
                ...prev,
                [entity_name]: isAlreadyInOptions
                  ? existingOptions
                  : [...existingOptions, response],
              };
            });
          })
          .catch((error: { message: string }) => {
            notifyError(error);
          });
      } else if (!value) {
        setSelectedOption(null);
      }
    }, [value, ikApi, entity_name, selectedOption, setBuffer]);

    useEffect(() => {
      if (inputValue.trim() === "") {
        fetchOptions("");
      } else if (inputValue.length >= 3) {
        fetchOptions(inputValue);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inputValue]);

    return (
      <FormControl fullWidth margin="normal">
        <Autocomplete
          disabled={otherProps.disabled}
          value={selectedOption}
          options={options}
          loading={loading}
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
          onInputChange={handleInputChange}
          filterOptions={(x) => x}
          renderInput={(params) => (
            <TextField
              {...params}
              {...otherProps}
              label={props.label}
              error={props.error}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>{loading ? "..." : params.InputProps.endAdornment}</>
                ),
              }}
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
  },
);

ReferenceSearchInput.displayName = "ReferenceSearchInput";
export default ReferenceSearchInput;
