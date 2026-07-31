import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Autocomplete, Chip, SxProps, TextField, Theme } from "@mui/material";

import { ReferenceLoader, ReferenceOption } from "../filter_panel/FilterConfig";

interface ReferenceAutocompleteProps {
  loadOptions: ReferenceLoader;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  sx?: SxProps<Theme>;
}

export const ReferenceAutocomplete = ({
  loadOptions,
  value,
  onChange,
  multiple = false,
  placeholder,
  sx,
}: ReferenceAutocompleteProps) => {
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labelCacheRef = useRef(new Map<string, string>());

  const cacheOptions = useCallback((nextOptions: ReferenceOption[]) => {
    nextOptions.forEach((option) => {
      labelCacheRef.current.set(option.value, option.label);
    });
  }, []);

  const selectedValues = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value],
  );

  useEffect(() => {
    setInputValue("");
    labelCacheRef.current.clear();
    setOptions([]);
    setLoading(true);
    loadOptions("")
      .then((nextOptions) => {
        cacheOptions(nextOptions);
        setOptions(nextOptions);
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [cacheOptions, loadOptions]);

  useEffect(() => {
    const missingIds = selectedValues.filter(
      (selectedValue) => !labelCacheRef.current.has(selectedValue),
    );

    if (missingIds.length === 0 || !loadOptions.resolveByIds) {
      return;
    }

    let active = true;
    loadOptions
      .resolveByIds(missingIds)
      .then((resolved) => {
        if (!active || resolved.length === 0) return;
        cacheOptions(resolved);
        setOptions((currentOptions) => {
          const mergedOptions = new Map(
            currentOptions.map((option) => [option.value, option]),
          );

          resolved.forEach((option) => {
            mergedOptions.set(option.value, option);
          });

          return Array.from(mergedOptions.values());
        });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [cacheOptions, loadOptions, selectedValues]);

  const handleInputChange = useCallback(
    (_e: React.SyntheticEvent, newInput: string, reason: string) => {
      if (reason === "reset") return;
      setInputValue(newInput);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setLoading(true);
        loadOptions(newInput)
          .then((nextOptions) => {
            cacheOptions(nextOptions);
            setOptions(nextOptions);
          })
          .catch(() => setOptions([]))
          .finally(() => setLoading(false));
      }, 300);
    },
    [cacheOptions, loadOptions],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const effectiveOptions = useMemo(() => {
    const optionValues = new Set(options.map((o) => o.value));
    const missing = selectedValues
      .filter((v) => !optionValues.has(v))
      .map((v) => ({
        label: labelCacheRef.current.get(v) || v,
        value: v,
      }));
    return [...missing, ...options];
  }, [options, selectedValues]);

  const selectedOption =
    !multiple && typeof value === "string"
      ? effectiveOptions.find((o) => o.value === value) || null
      : null;

  useEffect(() => {
    if (multiple) {
      return;
    }

    setInputValue(selectedOption?.label || "");
  }, [multiple, selectedOption]);

  if (multiple) {
    const arrValue = Array.isArray(value) ? value : value ? [value] : [];
    const selectedOptions = arrValue
      .map((v) => effectiveOptions.find((o) => o.value === v))
      .filter(Boolean) as ReferenceOption[];

    return (
      <Autocomplete
        multiple
        size="small"
        options={effectiveOptions}
        getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt.label)}
        isOptionEqualToValue={(opt, val) => opt.value === val.value}
        value={selectedOptions}
        onChange={(_e, newVal) => {
          onChange((newVal as ReferenceOption[]).map((o) => o.value));
          cacheOptions(newVal as ReferenceOption[]);
          setInputValue("");
          loadOptions("")
            .then((nextOptions) => {
              cacheOptions(nextOptions);
              setOptions(nextOptions);
            })
            .catch(() => setOptions([]));
        }}
        inputValue={inputValue}
        onInputChange={handleInputChange}
        loading={loading}
        filterOptions={(x) => x}
        renderTags={(val, getTagProps) =>
          val.map((option, index) => {
            const { key, ...rest } = getTagProps({ index });
            return (
              <Chip key={key} label={option.label} size="small" {...rest} />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={arrValue.length === 0 ? placeholder : ""}
          />
        )}
        sx={sx}
      />
    );
  }

  return (
    <Autocomplete
      size="small"
      options={effectiveOptions}
      getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt.label)}
      isOptionEqualToValue={(opt, val) => opt.value === val.value}
      value={selectedOption}
      onChange={(_e, newVal) =>
        onChange(
          newVal ? (typeof newVal === "string" ? newVal : newVal.value) : "",
        )
      }
      inputValue={inputValue}
      onInputChange={handleInputChange}
      loading={loading}
      filterOptions={(x) => x}
      renderInput={(params) => (
        <TextField {...params} placeholder={placeholder} />
      )}
      sx={sx}
    />
  );
};
