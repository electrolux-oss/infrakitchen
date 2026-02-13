import React, { useState, useEffect } from "react";

import { Autocomplete, Chip, InputAdornment, TextField } from "@mui/material";

import { AutocompleteFilterConfig, SearchFilterConfig } from "./FilterConfig";

export const CONTROL_HEIGHT = 40;

export const inputBaseHeightStyles = {
  height: CONTROL_HEIGHT,
  boxSizing: "border-box",
  padding: 0,
  alignItems: "center",
};

interface SearchFilterProps {
  config: SearchFilterConfig;
  value: string;
  onChange: (value: string) => void;
}

export const SearchFilter = ({
  config,
  value,
  onChange,
}: SearchFilterProps) => {
  const [localValue, setLocalValue] = useState(value || "");

  useEffect(() => {
    setLocalValue(value || "");
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      onChange(localValue);
    }
  };

  return (
    <TextField
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onKeyDown={handleKeyDown}
      label={config.label}
      placeholder={config.placeholder}
      size="small"
      slotProps={{
        input: {
          spellCheck: false,
          endAdornment: (
            <InputAdornment
              position="end"
              sx={{
                color: "text.secondary",
                opacity: 0.5,
                mr: 2,
              }}
            >
              Press ↵
            </InputAdornment>
          ),
        },
      }}
      sx={{
        width: "100%",
        "& .MuiInputBase-root": {
          ...inputBaseHeightStyles,
        },
        "& .MuiOutlinedInput-input": {
          pl: 1,
        },
      }}
    />
  );
};

interface AutocompleteFilterProps {
  config: AutocompleteFilterConfig;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: string[];
}

export const AutocompleteFilter = ({
  config,
  value,
  onChange,
  options,
}: AutocompleteFilterProps) => {
  const maxChipsToShow = config.maxChipsToShow ?? 3;
  const multiple = config.multiple ?? true;
  const filterSelectedOptions = config.filterSelectedOptions ?? true;
  const disableCloseOnSelect = config.disableCloseOnSelect ?? true;

  return (
    <Autocomplete
      multiple={multiple}
      options={options}
      value={multiple ? (Array.isArray(value) ? value : []) : value || null}
      onChange={(_, newValue) => onChange(newValue as string | string[])}
      disableCloseOnSelect={multiple ? disableCloseOnSelect : false}
      filterSelectedOptions={filterSelectedOptions}
      size="small"
      renderTags={(value: readonly string[], getTagProps) => {
        if (!Array.isArray(value)) return null;
        const visible = value.slice(0, maxChipsToShow);
        return [
          ...visible.map((option, index) => (
            <Chip
              label={option}
              {...getTagProps({ index })}
              key={option}
              size="small"
              variant="outlined"
            />
          )),
          value.length > maxChipsToShow ? (
            <Chip
              label={`+${value.length - maxChipsToShow}`}
              {...getTagProps({ index: maxChipsToShow })}
              key="more"
              size="small"
              variant="outlined"
            />
          ) : null,
        ];
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={config.label}
          placeholder={config.placeholder}
          sx={{
            "& .MuiInputBase-root": {
              ...inputBaseHeightStyles,
            },
          }}
        />
      )}
      sx={{
        width: "100%",
        "& .MuiAutocomplete-inputRoot": {
          ...inputBaseHeightStyles,
          flexWrap: "nowrap",
          overflow: "hidden",
        },
        "& .MuiChip-root": {
          maxWidth: "calc((100% - 65px) / 3)",
          "& .MuiChip-label": {
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
        },
      }}
    />
  );
};
