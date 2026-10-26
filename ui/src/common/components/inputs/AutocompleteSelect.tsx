import { ReactNode, useEffect, useMemo, useState } from "react";

import { Autocomplete } from "../../../ui";

export interface AsyncAutocompleteOption {
  label: string;
  value: string;
}

type AutocompleteValue = string | AsyncAutocompleteOption;

interface AsyncAutocompleteMultiProps {
  options: AsyncAutocompleteOption[];
  loadOptions?: () => Promise<AsyncAutocompleteOption[]>;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  freeSolo?: boolean;
  placeholder?: string;
  className?: string;
  /** Custom rendering for an option's label, used in the dropdown list and the selected value/chip. */
  renderOptionContent?: (option: AsyncAutocompleteOption) => ReactNode;
}

export const AutocompleteSelect = ({
  options: staticOptions,
  loadOptions,
  value,
  onChange,
  multiple = true,
  freeSolo = true,
  placeholder,
  className,
  renderOptionContent,
}: AsyncAutocompleteMultiProps) => {
  const [options, setOptions] =
    useState<AsyncAutocompleteOption[]>(staticOptions);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (loadOptions) {
      setLoading(true);
      loadOptions()
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
      return;
    }

    setOptions(staticOptions);
  }, [loadOptions, staticOptions]);

  const optionMap = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );

  const getOptionLabel = (option: AutocompleteValue) =>
    typeof option === "string" ? option : option.label;

  const toStoredValue = (option: AutocompleteValue | null) => {
    if (!option) return "";
    return typeof option === "string" ? option : option.value;
  };

  const isSameOption = (
    option: AsyncAutocompleteOption,
    selected: AutocompleteValue,
  ) => option.value === toStoredValue(selected);

  const getContent = (option: AutocompleteValue): ReactNode => {
    if (typeof option === "string") return option;
    return renderOptionContent ? renderOptionContent(option) : option.label;
  };

  if (multiple) {
    const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
    const selectedOptions = selectedValues.map(
      (selectedValue) => optionMap.get(selectedValue) || selectedValue,
    );

    return (
      <Autocomplete<AsyncAutocompleteOption, true, boolean>
        multiple
        freeSolo={freeSolo}
        options={options}
        loading={loading}
        value={selectedOptions}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={isSameOption}
        onChange={(_e, newValue) => onChange(newValue.map(toStoredValue))}
        renderOption={renderOptionContent}
        renderValue={getContent}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  const selectedOption =
    typeof value === "string" && value
      ? optionMap.get(value) || (freeSolo ? value : null)
      : null;

  return (
    <Autocomplete<AsyncAutocompleteOption, false, boolean>
      freeSolo={freeSolo}
      options={options}
      loading={loading}
      value={selectedOption}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isSameOption}
      onChange={(_e, newValue) => onChange(toStoredValue(newValue))}
      renderOption={renderOptionContent}
      renderValue={renderOptionContent ? getContent : undefined}
      placeholder={placeholder}
      className={className}
    />
  );
};
