import React, { useEffect, forwardRef, useState } from "react";

import {
  FormControl,
  FormHelperText,
  Autocomplete,
  TextField,
} from "@mui/material";

import { InfraKitchenApi } from "../../../api/InfraKitchenApi";
import { IkEntity } from "../../../types";
import { buildGraphqlFields } from "../../graphql/buildGraphqlFields";
import { notifyError } from "../../hooks/useNotification";

import { getOptionLabel } from "./utils";

const SNAKE_TO_CAMEL_RE = /_([a-z])/g;

const pluralEntityToGraphql = (entityName: string): string =>
  entityName.replace(SNAKE_TO_CAMEL_RE, (_, c) => c.toUpperCase());

interface ReferenceInputProps {
  ikApi: InfraKitchenApi;
  entity_name: string;
  onChange: (selectedEntity: any) => void;
  filter?: object;
  fields?: Array<string>;
  value: any;
  label: string;
  error?: boolean;
  showFields?: Array<string>;
  helpertext?: string;
  buffer: Record<string, IkEntity>;
  bufferKey?: string;
  setBuffer: (selectedEntity: any) => void;
  optionFilter?: (option: IkEntity) => boolean;
  getOptionDisabled?: (option: IkEntity) => boolean;
  options?: IkEntity[];
  [key: string]: any; // Allow additional props
}

const ReferenceInput = forwardRef<any, ReferenceInputProps>((props, _ref) => {
  const {
    ikApi,
    onChange,
    setBuffer,
    buffer,
    bufferKey,
    entity_name,
    filter = {},
    fields,
    showFields = ["name"],
    value,
    optionFilter,
    getOptionDisabled: getOptionDisabledProp,
    options: externalOptions,
    ...otherProps
  } = props;

  const graphqlEntityName = pluralEntityToGraphql(entity_name);
  const graphqlCountName = `${graphqlEntityName}Count`;
  const resolvedBufferKey = bufferKey || entity_name;
  const allOptions: IkEntity[] = buffer[resolvedBufferKey] || [];
  const options: IkEntity[] = optionFilter
    ? allOptions.filter(optionFilter)
    : allOptions;
  const [warning, setWarning] = useState<string | null>(null);

  const selectedOption =
    allOptions.find((option) => option.id === value) || null;

  const handleAutocompleteChange = (
    event: React.SyntheticEvent,
    newValue: IkEntity | null,
  ) => {
    onChange(newValue ? newValue.id : null);
  };

  const isOptionDisabled =
    getOptionDisabledProp ??
    ((option: IkEntity) => option.status === "disabled");

  useEffect(() => {
    if (externalOptions) {
      setBuffer((prev: Record<string, IkEntity[]>) => ({
        ...prev,
        [resolvedBufferKey]: externalOptions,
      }));
      return;
    }
    if (otherProps.disabled) {
      return;
    }
    if (!filter) {
      setBuffer((prev: Record<string, IkEntity[]>) => ({
        ...prev,
        [resolvedBufferKey]: [],
      }));
      return;
    }
    ikApi
      .graphqlRequest(
        `query ReferenceInput($filter: JSON, $sort: [String!], $range: [Int!]) {
          ${graphqlEntityName}(filter: $filter, sort: $sort, range: $range) {
            ${buildGraphqlFields(["id", ...(fields || showFields)])}
          }
          ${graphqlCountName}(filter: $filter)
        }`,
        {
          filter,
          sort: ["name", "ASC"],
          range: [0, 100],
        },
      )
      .then((response: { [key: string]: IkEntity[] | number }) => {
        const data = (response[graphqlEntityName] as IkEntity[]) || [];
        if (data.length === 0 && otherProps.required === true) {
          setWarning(
            `No available options for the required field "${props.label}". You need to create them first.`,
          );
        }

        setBuffer((prev: Record<string, IkEntity[]>) => ({
          ...prev,
          [resolvedBufferKey]: data,
        }));
      })
      .catch((error: { message: string }) => {
        notifyError(error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filter),
    entity_name,
    ikApi,
    setBuffer,
    resolvedBufferKey,
    externalOptions,
  ]);

  return (
    <FormControl fullWidth margin="normal">
      <Autocomplete
        readOnly={otherProps.readOnly}
        disabled={otherProps.disabled || otherProps.readOnly}
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
