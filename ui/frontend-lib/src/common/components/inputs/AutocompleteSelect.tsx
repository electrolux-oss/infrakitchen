import { useEffect, useMemo, useState } from "react";

import {
  Autocomplete,
  AutocompleteRenderValue,
  Chip,
  SxProps,
  TextField,
  Theme,
} from "@mui/material";

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
  sx?: SxProps<Theme>;
}

export const AutocompleteSelect = ({
  options: staticOptions,
  loadOptions,
  value,
  onChange,
  multiple = true,
  freeSolo = true,
  placeholder,
  sx,
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

  if (multiple) {
    const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
    const selectedOptions = selectedValues.map(
      (selectedValue) => optionMap.get(selectedValue) || selectedValue,
    );

    return (
      <Autocomplete
        multiple
        freeSolo={freeSolo}
        size="small"
        options={options}
        loading={loading}
        value={selectedOptions}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={isSameOption}
        onChange={(_e, newValue) =>
          onChange((newValue as AutocompleteValue[]).map(toStoredValue))
        }
        renderValue={(
          tagValue: AutocompleteRenderValue<
            AsyncAutocompleteOption,
            true,
            boolean
          >,
          getItemProps,
        ) =>
          tagValue.map((option, index) => {
            const { key, ...rest } = getItemProps({ index });
            return (
              <Chip
                key={key}
                label={getOptionLabel(option)}
                {...rest}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={selectedValues.length === 0 ? placeholder : ""}
          />
        )}
        sx={sx}
      />
    );
  }

  const selectedOption =
    typeof value === "string" && value
      ? optionMap.get(value) || (freeSolo ? value : null)
      : null;

  return (
    <Autocomplete
      freeSolo={freeSolo}
      size="small"
      options={options}
      loading={loading}
      value={selectedOption}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isSameOption}
      onChange={(_e, newValue) => onChange(toStoredValue(newValue))}
      renderInput={(params) => (
        <TextField {...params} placeholder={placeholder} />
      )}
      sx={sx}
    />
  );
};
