import React, { useEffect, forwardRef } from "react";

import { InfraKitchenApi } from "../../../api/InfraKitchenApi";
import { IkEntity } from "../../../types";
import {
  Autocomplete,
  Tooltip,
  FormControl,
  FormHelperText,
} from "../../../ui";
import { buildGraphqlFields } from "../../graphql/buildGraphqlFields";
import { notifyError } from "../../hooks/useNotification";

import { getReferenceQueryFields, ReferenceContent } from "./referenceContent";
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
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  /** Keep selected chips on a single line (horizontal scroll) so the control stays compact. */
  singleLine?: boolean;
  value: any;
  error?: boolean;
  setBuffer: (selectedEntity: any) => void;
  optionFilter?: (option: IkEntity) => boolean;
  renderOptionContent?: (option: IkEntity) => React.ReactNode;
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
      ariaLabel,
      placeholder,
      singleLine,
      value,
      optionFilter,
      renderOptionContent,
      tooltip,
      options: externalOptions,
      ...otherProps
    } = props;

    const graphqlEntityName = pluralEntityToGraphql(entity_name);
    const graphqlCountName = `${graphqlEntityName}Count`;
    const queryFields = getReferenceQueryFields(
      entity_name,
      fields || showFields,
    );

    const handleEntityChange = (
      _event: React.SyntheticEvent | null,
      value: IkEntity | IkEntity[] | null,
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
                    ${buildGraphqlFields(["id", "status", ...queryFields])}
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
      <FormControl fullWidth margin="dense">
        <Autocomplete<IkEntity, boolean>
          inputClassName={
            singleLine
              ? "h-8 flex-nowrap overflow-hidden py-0 [&>*]:shrink-0"
              : undefined
          }
          disableClearable
          disabled={otherProps.disabled || false}
          getOptionDisabled={isOptionDisabled}
          options={filteredOptions}
          getOptionLabel={(option) => getOptionLabel(option, showFields)}
          getOptionKey={(option) => String(option.id)}
          isOptionEqualToValue={(option, value) => option.id === value.id}
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
          renderValue={(option) => (
            <ReferenceContent
              entityName={entity_name}
              entity={option}
              fallback={option.name || option.identifier}
            />
          )}
          limitTags={5}
          label={label || undefined}
          aria-label={label ? undefined : ariaLabel || undefined}
          placeholder={placeholder}
          required={otherProps.required}
          error={props.error}
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
