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
  Select,
  TextField,
} from "@mui/material";

import { notifyError } from "../../hooks/useNotification";

import {
  AutocompleteFilterConfig,
  CascadingFilterConfig,
  CascadingOption,
  MultiSelectFilterConfig,
  SearchFilterConfig,
  SelectFilterConfig,
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

interface SelectFilterProps {
  config: SelectFilterConfig;
  value: string;
  onChange: (value: string) => void;
}

export const SelectFilter = ({
  config,
  value,
  onChange,
}: SelectFilterProps) => {
  return (
    <TextField
      select
      fullWidth
      size="small"
      label={config.label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      sx={{
        width: "100%",
        "& .MuiInputBase-root": {
          ...inputBaseHeightStyles,
        },
      }}
    >
      <MenuItem value="">All</MenuItem>
      {config.options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
};

interface MultiSelectFilterProps {
  config: MultiSelectFilterConfig;
  value: string[];
  onChange: (value: string[]) => void;
}

export const MultiSelectFilter = ({
  config,
  value,
  onChange,
}: MultiSelectFilterProps) => {
  return (
    <Select
      fullWidth
      multiple
      size="small"
      displayEmpty
      value={Array.isArray(value) ? value : []}
      onChange={(e) => onChange(e.target.value as string[])}
      renderValue={(selected) => {
        const values = selected as string[];
        if (values.length === 0) {
          return config.label;
        }
        return values
          .map(
            (selectedValue) =>
              config.options.find((o) => o.value === selectedValue)?.label ??
              selectedValue,
          )
          .join(", ");
      }}
      sx={{
        width: "100%",
        ...inputBaseHeightStyles,
      }}
    >
      {config.options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
};

interface CascadingFilterProps {
  config: CascadingFilterConfig;
  value: any;
  onChange: (value: any) => void;
}

export const CascadingFilter = ({
  config,
  value,
  onChange,
}: CascadingFilterProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadedOptions, setLoadedOptions] = useState<CascadingOption[]>([]);
  const [loadingTop, setLoadingTop] = useState(false);
  const [loadingChildren, setLoadingChildren] = useState<
    Record<string, boolean>
  >({});

  const isMenuOpen = Boolean(anchorEl);

  useEffect(() => {
    const loadTopLevel = async () => {
      if (config.loadOptions) {
        setLoadingTop(true);
        try {
          const options = await config.loadOptions();
          setLoadedOptions(options);
        } catch (error) {
          notifyError(error, { preventDuplicate: true });
        } finally {
          setLoadingTop(false);
        }
      } else if (config.options) {
        setLoadedOptions(config.options);
      }
    };
    loadTopLevel();
  }, [config.options, config.loadOptions, config]);

  const optionsLength = loadedOptions.length;

  // Effect to handle initial value resolution (loading children if path is provided as array)
  useEffect(() => {
    const resolvePath = async () => {
      if (!value || loadedOptions.length === 0) return;

      const path = Array.isArray(value) ? value : [value];

      // If we have a path, try to load children for each level except the last
      let updated = false;
      const newOptions = [...loadedOptions];

      for (let i = 0; i < path.length - 1; i++) {
        const val = path[i];
        const optionIdx = newOptions.findIndex((o) => o.value === val);
        const option = newOptions[optionIdx];

        if (option && option.loadChildren && !option.children) {
          try {
            const children = await option.loadChildren(val);
            newOptions[optionIdx] = { ...option, children };
            updated = true;
          } catch (error) {
            notifyError(error, { preventDuplicate: true });
            break;
          }
        }
      }

      if (updated) {
        setLoadedOptions(newOptions);
      }
    };

    resolvePath();
  }, [value, optionsLength, loadedOptions]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setExpandedId(null);
  };

  const handleSelect = (optionValue: any, parentValue?: any) => {
    if (parentValue) {
      onChange([parentValue, optionValue]);
    } else {
      onChange(optionValue);
    }
    handleClose();
  };

  const handleExpand = async (e: React.MouseEvent, option: CascadingOption) => {
    e.stopPropagation();
    if (expandedId === option.value) {
      setExpandedId(null);
      return;
    }

    setExpandedId(option.value);

    // If static children exist, don't try to load
    if (option.children && option.children.length > 0) {
      return;
    }

    if (option.loadChildren) {
      setLoadingChildren((prev) => ({ ...prev, [option.value]: true }));
      try {
        const children = await option.loadChildren(option.value);
        setLoadedOptions((prev) =>
          prev.map((opt) =>
            opt.value === option.value ? { ...opt, children } : opt,
          ),
        );
      } finally {
        setLoadingChildren((prev) => ({ ...prev, [option.value]: false }));
      }
    }
  };

  const findPathLabels = (
    options: CascadingOption[],
    val: any,
  ): string[] | null => {
    if (Array.isArray(val)) {
      const labels: string[] = [];
      let currentOptions = options;

      for (const v of val) {
        const opt = currentOptions.find((o) => o.value === v);
        if (!opt) return null;
        labels.push(opt.label);
        if (opt.children) {
          currentOptions = opt.children;
        } else if (val.indexOf(v) < val.length - 1) {
          return null;
        }
      }
      return labels;
    }

    for (const opt of options) {
      if (opt.value === val) return [opt.label];
      if (opt.children && Array.isArray(opt.children)) {
        const path = findPathLabels(opt.children, val);
        if (path) return [opt.label, ...path];
      }
    }
    return null;
  };

  const pathLabels = value ? findPathLabels(loadedOptions, value) : null;
  const displayLabel = pathLabels
    ? pathLabels.length > 1
      ? `${pathLabels[0]} / ${pathLabels[pathLabels.length - 1]}`
      : pathLabels[0]
    : null;

  const isSelected = (val: any) => {
    if (Array.isArray(value)) {
      return value.includes(val);
    }
    return value === val;
  };

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
        {loadingTop ? (
          <MenuItem disabled>Loading...</MenuItem>
        ) : loadedOptions.length === 0 ? (
          <MenuItem
            disabled
            sx={{ color: "text.secondary", fontStyle: "italic" }}
          >
            No options found
          </MenuItem>
        ) : (
          loadedOptions.map((opt) => (
            <Box key={opt.value}>
              <MenuItem
                key={opt.value}
                selected={isSelected(opt.value)}
                sx={{ display: "flex", justifyContent: "space-between", pr: 1 }}
              >
                <Box
                  sx={{ flexGrow: 1 }}
                  onClick={() => handleSelect(opt.value)}
                >
                  {opt.label}
                </Box>

                {(opt.children || opt.loadChildren) && (
                  <KeyboardArrowDownIcon
                    fontSize="small"
                    onClick={(e) => handleExpand(e, opt)}
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
              {expandedId === opt.value && (
                <Box>
                  {loadingChildren[opt.value] ? (
                    <MenuItem disabled sx={{ pl: 3, fontSize: "0.875rem" }}>
                      Loading...
                    </MenuItem>
                  ) : !opt.children || opt.children.length === 0 ? (
                    <MenuItem
                      disabled
                      sx={{
                        pl: 3,
                        fontSize: "0.875rem",
                        color: "text.secondary",
                        fontStyle: "italic",
                      }}
                    >
                      No options found
                    </MenuItem>
                  ) : (
                    Array.isArray(opt.children) &&
                    opt.children.map((child) => (
                      <MenuItem
                        key={child.value}
                        onClick={() => handleSelect(child.value, opt.value)}
                        selected={isSelected(child.value)}
                        sx={{
                          pl: 3,
                          color: "text.secondary",
                        }}
                      >
                        {child.label}
                      </MenuItem>
                    ))
                  )}
                </Box>
              )}
            </Box>
          ))
        )}
      </Menu>
    </Box>
  );
};
