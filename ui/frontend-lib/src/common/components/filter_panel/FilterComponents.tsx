import React, { useState, useEffect } from "react";

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ClearIcon from "@mui/icons-material/Clear";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {
  Autocomplete,
  Box,
  Chip,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
} from "@mui/material";

import {
  AutocompleteFilterConfig,
  CascadingFilterConfig,
  CascadingOption,
  SearchFilterConfig,
} from "./FilterConfig";

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

interface CascadingMenuFilterProps {
  config: CascadingFilterConfig;
  value: any;
  onChange: (value: any) => void;
}

export const CascadingMenuFilter = ({
  config,
  value,
  onChange,
}: CascadingMenuFilterProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isMenuOpen = Boolean(anchorEl);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setExpandedId(null);
  };

  const handleSelect = (optionValue: any) => {
    onChange(optionValue);
    handleClose();
  };

  const findPathLabels = (
    options: CascadingOption[],
    val: any,
  ): string[] | null => {
    for (const opt of options) {
      if (opt.value === val) return [opt.label];
      if (opt.children) {
        const path = findPathLabels(opt.children, val);
        if (path) return [opt.label, ...path];
      }
    }
    return null;
  };

  const pathLabels = value ? findPathLabels(config.options, value) : null;
  const displayLabel = pathLabels
    ? pathLabels.length > 1
      ? `${pathLabels[0]} / ${pathLabels[pathLabels.length - 1]}`
      : pathLabels[0]
    : null;

  return (
    <Box sx={{ width: "100%" }}>
      <TextField
        label={config.label}
        placeholder={config.placeholder}
        value={displayLabel ?? ""}
        size="small"
        fullWidth
        InputLabelProps={{ shrink: isMenuOpen || Boolean(displayLabel) }}
        slotProps={{
          input: {
            readOnly: true,
            onClick: handleOpen,
            endAdornment: (
              <InputAdornment position="end">
                {value ? (
                  <ClearIcon
                    fontSize="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(null);
                    }}
                    sx={{
                      color: "action.active",
                      cursor: "pointer",
                      fontSize: 18,
                    }}
                  />
                ) : (
                  <ArrowDropDownIcon
                    sx={{
                      color: "text.secondary",
                      transition: "transform 0.2s",
                      transform: isMenuOpen ? "rotate(180deg)" : "none",
                    }}
                  />
                )}
              </InputAdornment>
            ),
          },
        }}
        sx={{
          width: "100%",
          "& .MuiInputBase-root": {
            ...inputBaseHeightStyles,
            cursor: "pointer",
            pr: 1,
          },
          "& .MuiOutlinedInput-input": {
            cursor: "pointer",
            pr: 0,
            pl: 1.5,
          },
        }}
      />

      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleClose}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: { minWidth: anchorEl?.offsetWidth ?? 180 },
          },
        }}
      >
        {config.options.map((opt) => (
          <Box key={opt.value}>
            <MenuItem
              key={opt.value}
              selected={value === opt.value}
              sx={{ display: "flex", justifyContent: "space-between", pr: 1 }}
            >
              <Box sx={{ flexGrow: 1 }} onClick={() => handleSelect(opt.value)}>
                {opt.label}
              </Box>

              {opt.children && (
                <KeyboardArrowDownIcon
                  fontSize="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedId(expandedId === opt.value ? null : opt.value);
                  }}
                  sx={{
                    ml: 1,
                    color: "text.secondary",
                    cursor: "pointer",
                    transition: "transform 0.2s",
                    transform:
                      expandedId === opt.value ? "rotate(180deg)" : "none",
                  }}
                />
              )}
            </MenuItem>

            {/* Inline children */}
            {opt.children && expandedId === opt.value && (
              <Box>
                {opt.children.map((child) => (
                  <MenuItem
                    key={child.value}
                    onClick={() => handleSelect(child.value)}
                    selected={value === child.value}
                    sx={{
                      pl: 3,
                      color: "text.secondary",
                    }}
                  >
                    {child.label}
                  </MenuItem>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Menu>
    </Box>
  );
};
