import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Autocomplete,
  AutocompleteRenderValue,
  Box,
  Chip,
  SxProps,
  TextField,
  Theme,
} from "@mui/material";

import { ReferenceLoader, ReferenceOption } from "../filter_panel/FilterConfig";
import { Label } from "../labels/Label";

interface ReferenceAutocompleteProps {
  loadOptions: ReferenceLoader;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  sx?: SxProps<Theme>;
}

const ReferenceOptionContent = ({
  option,
  labelSx,
}: {
  option: ReferenceOption;
  labelSx?: SxProps<Theme>;
}) => (
  <>
    {option.templateName && (
      <Label
        label={option.templateName}
        sx={{ mr: 1, height: 20, fontSize: "0.75rem" }}
      />
    )}
    {option.icon && (
      <Box
        component="span"
        sx={{ mr: 0.5, display: "inline-flex", alignItems: "center" }}
      >
        {option.icon}
      </Box>
    )}
    <Box component="span" sx={labelSx}>
      {option.label}
    </Box>
  </>
);

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

  const effectiveOptions: ReferenceOption[] = useMemo(() => {
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

    // The selected value is rendered as rich content via renderValue, so the
    // input text stays empty to avoid duplicating the label.
    setInputValue("");
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
        renderValue={(
          val: AutocompleteRenderValue<ReferenceOption, true, false>,
          getItemProps,
        ) =>
          val.map((option, index) => {
            const { key, ...rest } = getItemProps({ index });
            return <Chip key={key} label={option.label} {...rest} />;
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
      renderOption={(props, option) => {
        const opt = option as ReferenceOption;
        return (
          <li {...props} key={opt.value}>
            <ReferenceOptionContent option={opt} />
          </li>
        );
      }}
      renderValue={(option, getItemProps) => {
        // Drop the chip delete handler; it doesn't belong on the plain span.
        const { onDelete: _onDelete, ...itemProps } = getItemProps();
        return (
          <Box
            component="span"
            {...itemProps}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <ReferenceOptionContent
              option={option}
              labelSx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            />
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={selectedOption ? "" : placeholder}
        />
      )}
      sx={sx}
    />
  );
};
