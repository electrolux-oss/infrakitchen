import { useEffect, useRef, useState } from "react";

import { TextField } from "../../../ui";
import { AutocompleteSelect, ReferenceAutocomplete } from "../inputs";

import { isMultiValueOperator, isValuelessOperator } from "./clauseUtils";
import { FilterClause, FilterableField } from "./FilterConfig";

const INPUT_CLASS = "w-full min-w-0";

function toAutocompleteOptions(options: string[]) {
  return options.map((option) => ({ label: option, value: option }));
}

interface FilterValueInputProps {
  clause: FilterClause;
  clauses: FilterClause[];
  field: FilterableField;
  /** Applies a picked value right away. */
  onChange: (value: any) => void;
  /** Called on every keystroke of a free-text value; the caller debounces. */
  onTextChange: (text: string) => void;
  /** Enter in a free-text value. */
  onSubmit: () => void;
}

export const FilterValueInput = ({
  clause,
  clauses,
  field,
  onChange,
  onTextChange,
  onSubmit,
}: FilterValueInputProps) => {
  const [text, setText] = useState(
    typeof clause.value === "string" ? clause.value : "",
  );
  const lastTypedRef = useRef(text);

  // Follow outside changes (e.g. a dependency cleared this value) without
  // clobbering what the user is still typing.
  useEffect(() => {
    const next = typeof clause.value === "string" ? clause.value : "";
    if (next !== lastTypedRef.current) {
      lastTypedRef.current = next;
      setText(next);
    }
  }, [clause.value]);

  if (isValuelessOperator(clause.operator)) {
    return null;
  }

  const multiValue = isMultiValueOperator(clause.operator);
  // Remount when a field this one depends on (e.g. Template Version on
  // Template) changes, so its options reload with the new scope.
  const dependencyKey = (field.dependencies || [])
    .map((dep) => {
      const depValue = clauses.find((c) => c.field === dep)?.value;
      const serialized = Array.isArray(depValue)
        ? depValue.join(",")
        : String(depValue ?? "");
      return `${dep}=${serialized}`;
    })
    .join("&");
  const key = `${clause.field}::${clause.operator}::${dependencyKey}`;
  const label = field.label.toLowerCase();

  if (field.valueType === "reference" && field.loadReferenceOptions) {
    return (
      <ReferenceAutocomplete
        key={key}
        loadOptions={field.loadReferenceOptions}
        value={clause.value}
        onChange={onChange}
        multiple={multiValue}
        placeholder={`Search ${label}...`}
        className={INPUT_CLASS}
      />
    );
  }

  if (
    multiValue &&
    (field.valueType === "autocomplete-multiple" || field.options)
  ) {
    const loader =
      typeof field.options === "function" ? field.options : undefined;
    const staticOptions =
      typeof field.options === "function" ? [] : field.options || [];
    return (
      <AutocompleteSelect
        key={key}
        options={toAutocompleteOptions(staticOptions)}
        loadOptions={
          loader ? () => loader().then(toAutocompleteOptions) : undefined
        }
        value={Array.isArray(clause.value) ? clause.value : []}
        onChange={onChange}
        multiple
        freeSolo
        placeholder={`Select ${label}...`}
        className={INPUT_CLASS}
      />
    );
  }

  if (field.selectOptions) {
    const renderOptionContent = field.renderSelectOption
      ? (option: { label: string; value: string }) =>
          field.renderSelectOption!(option.value, option.label)
      : undefined;
    return (
      <AutocompleteSelect
        key={key}
        options={field.selectOptions}
        value={
          multiValue
            ? Array.isArray(clause.value)
              ? clause.value
              : []
            : clause.value || ""
        }
        onChange={onChange}
        multiple={multiValue}
        freeSolo={false}
        placeholder={multiValue ? `Select ${label}...` : "Select..."}
        className={INPUT_CLASS}
        renderOptionContent={renderOptionContent}
      />
    );
  }

  if (multiValue) {
    return (
      <AutocompleteSelect
        key={key}
        options={[]}
        value={Array.isArray(clause.value) ? clause.value : []}
        onChange={onChange}
        multiple
        freeSolo
        placeholder={field.placeholder ?? "Type a value, press Enter..."}
        className={INPUT_CLASS}
      />
    );
  }

  return (
    <TextField
      className={INPUT_CLASS}
      value={text}
      onChange={(e) => {
        lastTypedRef.current = e.target.value;
        setText(e.target.value);
        onTextChange(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSubmit();
        }
      }}
      placeholder={field.placeholder ?? `Filter by ${label}...`}
    />
  );
};
