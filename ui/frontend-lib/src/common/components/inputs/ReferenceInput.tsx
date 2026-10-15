import React, { useEffect, forwardRef, useState } from "react";

import { InfraKitchenApi } from "../../../api/InfraKitchenApi";
import { IkEntity } from "../../../types";
import { Autocomplete, FormControl, FormHelperText } from "../../../ui";
import { buildGraphqlFields } from "../../graphql/buildGraphqlFields";
import { notifyError } from "../../hooks/useNotification";

import { getReferenceQueryFields, ReferenceContent } from "./referenceContent";
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
  sort?: Array<string>;
  value: any;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  error?: boolean;
  showFields?: Array<string>;
  helpertext?: string;
  buffer: Record<string, IkEntity>;
  bufferKey?: string;
  setBuffer: (selectedEntity: any) => void;
  optionFilter?: (option: IkEntity) => boolean;
  getOptionDisabled?: (option: IkEntity) => boolean;
  options?: IkEntity[];
  renderOptionContent?: (option: IkEntity) => React.ReactNode;
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
    sort = ["name", "ASC"],
    showFields = ["name"],
    value,
    optionFilter,
    getOptionDisabled: getOptionDisabledProp,
    options: externalOptions,
    renderOptionContent,
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
  const queryFields = getReferenceQueryFields(
    entity_name,
    fields || showFields,
  );

  const selectedOption =
    allOptions.find((option) => option.id === value) || null;

  const handleAutocompleteChange = (
    _event: React.SyntheticEvent | null,
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
                  ${buildGraphqlFields(["id", ...queryFields])}
                }
                ${graphqlCountName}(filter: $filter)
              }`,
        {
          filter,
          sort: sort,
          range: [0, 100],
        },
      )
      .then((response: { [key: string]: IkEntity[] | number }) => {
        const data = (response[graphqlEntityName] as IkEntity[]) || [];
        if (data.length === 0 && otherProps.required === true) {
          setWarning(
            `No available options for the required field "${props.label || props.ariaLabel || "this field"}". You need to create them first.`,
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
    <FormControl fullWidth margin="dense">
      <Autocomplete
        readOnly={otherProps.readOnly}
        disabled={otherProps.disabled || otherProps.readOnly}
        value={selectedOption}
        options={options}
        getOptionLabel={(option) => getOptionLabel(option, showFields)}
        getOptionKey={(option) => option.id}
        renderOption={(option) =>
          renderOptionContent ? (
            renderOptionContent(option)
          ) : (
            <ReferenceContent
              entityName={entity_name}
              entity={option}
              fallback={getOptionLabel(option, showFields)}
            />
          )
        }
        isOptionEqualToValue={(option, value) => option.id === value.id}
        getOptionDisabled={isOptionDisabled}
        onChange={handleAutocompleteChange}
        renderValue={(option) => (
          <ReferenceContent
            entityName={entity_name}
            entity={option}
            fallback={option.name || option.identifier}
          />
        )}
        label={props.label || undefined}
        aria-label={props.label ? undefined : props.ariaLabel || undefined}
        placeholder={props.placeholder}
        error={props.error}
        required={otherProps.required}
        name={otherProps.name}
        onBlur={otherProps.onBlur}
      />
      <FormHelperText error={props.error}>
        {props.helpertext || ""}
      </FormHelperText>
      {warning && (
        <FormHelperText className="text-warning">{warning}</FormHelperText>
      )}
    </FormControl>
  );
});

ReferenceInput.displayName = "ReferenceInput";
export default ReferenceInput;
