import React, { useEffect, forwardRef } from "react";

import {
  FormControl,
  Autocomplete,
  TextField,
  Chip,
  FormHelperText,
  Tooltip,
} from "@mui/material";

import { InfraKitchenApi } from "../../../api/InfraKitchenApi";
import { IkEntity } from "../../../types";
import { buildGraphqlFields } from "../../graphql/buildGraphqlFields";
import { notifyError } from "../../hooks/useNotification";

import { getOptionLabel } from "./utils";

const SNAKE_TO_CAMEL_RE = /_([a-z])/g;

const pluralEntityToGraphql = (entityName: string): string =>
  entityName.replace(SNAKE_TO_CAMEL_RE, (_, c) => c.toUpperCase());

interface ArrayReferenceInputProps {
  ikApi: InfraKitchenApi;
  entity_name: string;
  onChange: (selectedEntity: any[]) => void;
  filter?: object;
  fields?: Array<string>;
  multiple?: boolean;
  helpertext?: string;
  buffer: Record<string, IkEntity[]>;
  bufferKey?: string;
  showFields?: Array<string>;
  label: string;
  value: any;
  error?: boolean;
  setBuffer: (selectedEntity: any) => void;
  optionFilter?: (option: IkEntity) => boolean;
  tooltip?: string;
  options?: IkEntity[];
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
      bufferKey,
      fields,
      filter = {},
      label,
      value,
      optionFilter,
      tooltip,
      options: externalOptions,
      ...otherProps
    } = props;

    const graphqlEntityName = pluralEntityToGraphql(entity_name);
    const graphqlCountName = `${graphqlEntityName}Count`;

    const handleEntityChange = (
      _event: React.SyntheticEvent,
      value: IkEntity | IkEntity[] | null,
      _reason: string,
      _details?: any,
    ) => {
      if (Array.isArray(value)) {
        onChange(value.map((entity) => String(entity.id)));
      } else if (value && typeof value === "object") {
        onChange([String(value.id)]);
      } else {
        onChange([]);
      }
    };

    const isOptionDisabled = (option: IkEntity) => option.status === "disabled";

    const resolvedBufferKey = bufferKey || entity_name;

    const filteredOptions = optionFilter
      ? (buffer[resolvedBufferKey] || []).filter(optionFilter)
      : buffer[resolvedBufferKey] || [];

    useEffect(() => {
      if (externalOptions) {
        setBuffer((prev: Record<string, IkEntity[]>) => ({
          ...prev,
          [resolvedBufferKey]: externalOptions,
        }));
        return;
      }
      ikApi
        .graphqlRequest(
          `query ArrayReferenceInput($filter: JSON, $sort: [String!], $range: [Int!]) {
            ${graphqlEntityName}(filter: $filter, sort: $sort, range: $range) {
              ${buildGraphqlFields(["id", "status", ...(fields || showFields)])}
            }
            ${graphqlCountName}(filter: $filter)
          }`,
          {
            filter,
            sort: ["name", "ASC"],
            range: [0, 1000],
          },
        )
        .then((response: { [key: string]: IkEntity[] | number }) => {
          const data = (response[graphqlEntityName] as IkEntity[]) || [];
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
      ikApi,
      entity_name,
      setBuffer,
      externalOptions,
    ]);

    const control = (
      <FormControl fullWidth margin="normal">
        <Autocomplete
          sx={{
            "& .MuiOutlinedInput-root": {
              height: "auto",
              paddingTop: "6px",
              paddingBottom: "6px",
              alignItems: "center",
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
          options={filteredOptions}
          getOptionLabel={(option) => getOptionLabel(option, showFields)}
          isOptionEqualToValue={(option, value) =>
            option.id === (value?.id || value)
          }
          value={
            otherProps.multiple
              ? buffer[resolvedBufferKey]?.filter((e: IkEntity) =>
                  value?.includes(e.id.toString()),
                ) || [] // Ensure array for multiple
              : buffer[resolvedBufferKey]?.find(
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

    if (tooltip) {
      return (
        <Tooltip title={tooltip} placement="top" arrow>
          <span style={{ display: "block", width: "100%" }}>{control}</span>
        </Tooltip>
      );
    }

    return control;
  },
);

ArrayReferenceInput.displayName = "ArrayReferenceInput";

export default ArrayReferenceInput;
