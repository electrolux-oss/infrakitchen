import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Autocomplete, AutocompleteInputChangeReason } from "../../../ui";
import VersionLifecycleStateChip from "../../VersionLifecycleStateChip";
import { ReferenceLoader, ReferenceOption } from "../filter_panel/FilterConfig";
import { Label } from "../labels/Label";

interface ReferenceAutocompleteProps {
  loadOptions: ReferenceLoader;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  className?: string;
}

const ReferenceOptionContent = ({
  option,
  labelClassName,
}: {
  option: ReferenceOption;
  labelClassName?: string;
}) => (
  <>
    {option.templateName && (
      <Label className="mr-2" label={option.templateName} />
    )}
    {option.icon && (
      <span className="mr-1 inline-flex items-center">{option.icon}</span>
    )}
    <span className={labelClassName}>{option.label}</span>
    {option.lifecycleState && (
      <span className="ml-2 inline-flex items-center">
        <VersionLifecycleStateChip
          lifecycleState={option.lifecycleState}
          breakingChanges={option.breakingChanges ?? undefined}
        />
      </span>
    )}
  </>
);

export const ReferenceAutocomplete = ({
  loadOptions,
  value,
  onChange,
  multiple = false,
  placeholder,
  className,
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
    (
      _e: React.SyntheticEvent | null,
      newInput: string,
      reason: AutocompleteInputChangeReason,
    ) => {
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
        options={effectiveOptions}
        getOptionLabel={(opt) => opt.label}
        getOptionKey={(opt) => opt.value}
        isOptionEqualToValue={(opt, val) => opt.value === val.value}
        value={selectedOptions}
        onChange={(_e, newVal) => {
          onChange(newVal.map((o) => o.value));
          cacheOptions(newVal);
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
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <Autocomplete
      options={effectiveOptions}
      getOptionLabel={(opt) => opt.label}
      getOptionKey={(opt) => opt.value}
      isOptionEqualToValue={(opt, val) => opt.value === val.value}
      value={selectedOption}
      onChange={(_e, newVal) => onChange(newVal ? newVal.value : "")}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      loading={loading}
      filterOptions={(x) => x}
      renderOption={(option) => <ReferenceOptionContent option={option} />}
      renderValue={(option) => (
        <ReferenceOptionContent option={option} labelClassName="truncate" />
      )}
      placeholder={placeholder}
      className={className}
    />
  );
};
