import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { AutocompleteSelect, ReferenceAutocomplete } from "../inputs";

import {
  FilterConfig,
  FilterableField,
  FilterClause,
  FilterOperator,
} from "./FilterConfig";

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: "is",
  like: "contains",
  not_like: "does not contain",
  in: "is any of",
  contains_all: "has all of",
  any: "matches any",
};

let clauseIdCounter = 0;
function generateClauseId(): string {
  return `clause_${Date.now()}_${++clauseIdCounter}`;
}

function isMultiValueOperator(op: FilterOperator): boolean {
  return op === "in" || op === "contains_all" || op === "any";
}

function getDefaultOperator(field?: FilterableField): FilterOperator {
  return field?.defaultOperator || field?.operators[0] || "eq";
}

const VALUE_INPUT_SX = {
  flex: "1 1 280px",
  minWidth: 0,
} as const;

const ROW_HEIGHT = 40;

const SINGLE_VALUE_INPUT_SX = {
  ...VALUE_INPUT_SX,
  "& .MuiInputBase-root": {
    height: ROW_HEIGHT,
  },
} as const;

const SINGLE_VALUE_REFERENCE_AUTOCOMPLETE_SX = {
  ...VALUE_INPUT_SX,
  "& .MuiInputBase-root": {
    height: ROW_HEIGHT,
    flexWrap: "nowrap",
  },
} as const;

const MULTI_VALUE_AUTOCOMPLETE_SX = {
  ...VALUE_INPUT_SX,
  "& .MuiInputBase-root": {
    minHeight: ROW_HEIGHT,
  },
} as const;

function toAutocompleteOptions(options: string[]) {
  return options.map((option) => ({ label: option, value: option }));
}

interface AdvancedFilterProps {
  config: FilterConfig;
  value: FilterClause[];
  onChange: (clauses: FilterClause[]) => void;
}

interface ClauseRowProps {
  clause: FilterClause;
  fields: FilterableField[];
  usedFields: Set<string>;
  usedFieldOperatorPairs: Set<string>;
  onUpdate: (id: string, updates: Partial<FilterClause>) => void;
  onRemove: (id: string) => void;
  isOnly: boolean;
}

const ClauseRow = ({
  clause,
  fields,
  usedFields,
  usedFieldOperatorPairs,
  onUpdate,
  onRemove,
  isOnly,
}: ClauseRowProps) => {
  const selectedField = fields.find((f) => f.field === clause.field);
  const availableOperators = useMemo(
    () => selectedField?.operators || [],
    [selectedField],
  );

  // Local text value for debounced commit
  const [localTextValue, setLocalTextValue] = useState(
    typeof clause.value === "string" ? clause.value : "",
  );

  useEffect(() => {
    setLocalTextValue(typeof clause.value === "string" ? clause.value : "");
  }, [clause.value]);

  useEffect(() => {
    if (!selectedField || availableOperators.length === 0) return;
    if (availableOperators.includes(clause.operator)) return;

    const defaultOp = getDefaultOperator(selectedField);
    onUpdate(clause.id, {
      operator: defaultOp,
      value: isMultiValueOperator(defaultOp)
        ? Array.isArray(clause.value)
          ? clause.value
          : clause.value
            ? [clause.value]
            : []
        : Array.isArray(clause.value)
          ? clause.value[0] || ""
          : clause.value || "",
    });
  }, [
    availableOperators,
    clause.id,
    clause.operator,
    clause.value,
    onUpdate,
    selectedField,
  ]);

  const handleFieldChange = (newField: string) => {
    const field = fields.find((f) => f.field === newField);
    const defaultOp = getDefaultOperator(field);
    const defaultValue = isMultiValueOperator(defaultOp) ? [] : "";
    onUpdate(clause.id, {
      field: newField,
      operator: defaultOp,
      value: defaultValue,
    });
  };

  const handleOperatorChange = (newOp: FilterOperator) => {
    const wasMulti = isMultiValueOperator(clause.operator);
    const isMulti = isMultiValueOperator(newOp);
    let newValue = clause.value;
    if (wasMulti && !isMulti) {
      newValue = Array.isArray(clause.value) ? clause.value[0] || "" : "";
    } else if (!wasMulti && isMulti) {
      newValue = clause.value ? [clause.value] : [];
    }
    onUpdate(clause.id, { operator: newOp, value: newValue });
  };

  const handleTextCommit = () => {
    if (localTextValue !== clause.value) {
      onUpdate(clause.id, { value: localTextValue });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTextCommit();
    }
  };

  // Check which field+operator pairs are taken (for disabling duplicates)
  const isFieldOperatorTaken = (field: string, op: FilterOperator) => {
    const key = `${field}::${op}`;
    return (
      usedFieldOperatorPairs.has(key) &&
      !(clause.field === field && clause.operator === op)
    );
  };

  // Available field options (filter out fields where ALL operators are taken)
  const availableFields = fields.filter((f) => {
    if (f.field === clause.field) return true;
    return !usedFields.has(f.field);
  });

  // Render value input
  const renderValueInput = () => {
    if (!selectedField) {
      return (
        <TextField
          size="small"
          disabled
          placeholder="Select a field first"
          sx={SINGLE_VALUE_INPUT_SX}
        />
      );
    }

    const multiValue = isMultiValueOperator(clause.operator);
    const valueInputKey = `${clause.field}::${clause.operator}`;

    // Reference field: server-side search autocomplete (handles both single and multi)
    if (
      selectedField.valueType === "reference" &&
      selectedField.loadReferenceOptions
    ) {
      return (
        <ReferenceAutocomplete
          key={valueInputKey}
          loadOptions={selectedField.loadReferenceOptions}
          value={clause.value}
          onChange={(newVal) => onUpdate(clause.id, { value: newVal })}
          multiple={multiValue}
          placeholder={`Search ${selectedField.label.toLowerCase()}...`}
          sx={
            multiValue
              ? MULTI_VALUE_REFERENCE_AUTOCOMPLETE_SX
              : SINGLE_VALUE_REFERENCE_AUTOCOMPLETE_SX
          }
        />
      );
    }

    if (
      multiValue &&
      (selectedField.valueType === "autocomplete-multiple" ||
        selectedField.options)
    ) {
      const optionsLoader =
        typeof selectedField.options === "function"
          ? selectedField.options
          : undefined;
      const staticOptionSource =
        typeof selectedField.options === "function"
          ? undefined
          : selectedField.options;
      const loadOptions = optionsLoader
        ? () => optionsLoader().then(toAutocompleteOptions)
        : undefined;
      const staticOptions = staticOptionSource || [];

      return (
        <AutocompleteSelect
          key={valueInputKey}
          options={toAutocompleteOptions(staticOptions)}
          loadOptions={loadOptions}
          value={Array.isArray(clause.value) ? clause.value : []}
          onChange={(newVal) => onUpdate(clause.id, { value: newVal })}
          multiple
          freeSolo
          placeholder={`Select ${selectedField.label.toLowerCase()}...`}
          sx={MULTI_VALUE_AUTOCOMPLETE_SX}
        />
      );
    }

    if (multiValue && selectedField.selectOptions) {
      return (
        <AutocompleteSelect
          key={valueInputKey}
          options={selectedField.selectOptions}
          value={Array.isArray(clause.value) ? clause.value : []}
          onChange={(newVal) => onUpdate(clause.id, { value: newVal })}
          multiple
          freeSolo={false}
          placeholder={`Select ${selectedField.label.toLowerCase()}...`}
          sx={MULTI_VALUE_AUTOCOMPLETE_SX}
        />
      );
    }

    if (multiValue) {
      return (
        <AutocompleteSelect
          key={valueInputKey}
          options={[]}
          value={Array.isArray(clause.value) ? clause.value : []}
          onChange={(newVal) => onUpdate(clause.id, { value: newVal })}
          multiple
          freeSolo
          placeholder={`Type values, press Enter...`}
          sx={MULTI_VALUE_AUTOCOMPLETE_SX}
        />
      );
    }

    if (selectedField.selectOptions) {
      return (
        <AutocompleteSelect
          key={valueInputKey}
          options={selectedField.selectOptions}
          value={clause.value || ""}
          onChange={(newVal) => onUpdate(clause.id, { value: newVal })}
          multiple={false}
          freeSolo={false}
          placeholder="Select..."
          sx={SINGLE_VALUE_INPUT_SX}
        />
      );
    }

    // Default: text input
    return (
      <TextField
        size="small"
        value={localTextValue}
        onChange={(e) => setLocalTextValue(e.target.value)}
        onBlur={handleTextCommit}
        onKeyDown={handleKeyDown}
        placeholder={`Filter by ${selectedField.label.toLowerCase()}...`}
        sx={SINGLE_VALUE_INPUT_SX}
      />
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        width: "100%",
        flexWrap: "nowrap",
        minWidth: 0,
        p: 1,
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        backgroundColor: "background.paper",
      }}
    >
      {/* Field selector */}
      <Select
        size="small"
        value={clause.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        displayEmpty
        sx={{ flex: "0 0 220px", minWidth: 0, height: ROW_HEIGHT }}
      >
        <MenuItem value="" disabled>
          <Typography variant="body2" color="text.secondary">
            Field...
          </Typography>
        </MenuItem>
        {availableFields.map((f) => (
          <MenuItem key={f.field} value={f.field}>
            {f.label}
          </MenuItem>
        ))}
      </Select>

      {/* Operator selector */}
      <Select
        size="small"
        value={clause.operator}
        onChange={(e) => handleOperatorChange(e.target.value as FilterOperator)}
        disabled={!clause.field || availableOperators.length <= 1}
        sx={{ flex: "0 0 160px", minWidth: 0, height: ROW_HEIGHT }}
      >
        {availableOperators.map((op) => (
          <MenuItem
            key={op}
            value={op}
            disabled={isFieldOperatorTaken(clause.field, op)}
          >
            {OPERATOR_LABELS[op]}
          </MenuItem>
        ))}
      </Select>

      {/* Value input */}
      {renderValueInput()}

      {/* Remove button */}
      <Tooltip title="Remove filter">
        <span>
          <IconButton
            size="small"
            onClick={() => onRemove(clause.id)}
            disabled={isOnly && !clause.field}
            sx={{
              color: "text.secondary",
              border: 1,
              borderColor: "divider",
              borderRadius: 1.5,
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};

function makeEmptyClause(): FilterClause {
  return {
    id: generateClauseId(),
    field: "",
    operator: "like" as FilterOperator,
    value: "",
  };
}

export const AdvancedFilter = ({
  config,
  value,
  onChange,
}: AdvancedFilterProps) => {
  const { fields } = config;

  const toPersistedClauses = useCallback((nextClauses: FilterClause[]) => {
    return nextClauses.filter((clause) => {
      if (!clause.field) return false;
      if (
        clause.value === undefined ||
        clause.value === null ||
        clause.value === ""
      ) {
        return false;
      }
      if (Array.isArray(clause.value) && clause.value.length === 0) {
        return false;
      }
      return true;
    });
  }, []);

  // Maintain local clause state so incomplete rows aren't lost on URL re-render.
  // Sync from external value only on initial mount or explicit reset.
  const [clauses, setClauses] = useState<FilterClause[]>(() => {
    if (value && value.length > 0) return value;
    return [makeEmptyClause()];
  });

  // Track whether this is an external reset (e.g. "Reset" button clears all)
  const prevValueRef = useRef(value);
  const awaitingInternalEmptySyncRef = useRef(false);
  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;

    if (value && value.length > 0) {
      awaitingInternalEmptySyncRef.current = false;
    }

    // External reset: value went from non-empty to empty/undefined
    if (
      (!value || value.length === 0) &&
      prev &&
      prev.length > 0 &&
      !awaitingInternalEmptySyncRef.current
    ) {
      setClauses([makeEmptyClause()]);
    } else if (!value || value.length === 0) {
      awaitingInternalEmptySyncRef.current = false;
    }
    // External load from URL on mount (clauses are still the default empty row)
    else if (value.length > 0 && clauses.length === 1 && !clauses[0].field) {
      setClauses(value);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Propagate changes to parent (which writes to URL)
  const propagate = useCallback(
    (updated: FilterClause[]) => {
      const persistedClauses = toPersistedClauses(updated);
      awaitingInternalEmptySyncRef.current = persistedClauses.length === 0;
      setClauses(updated);
      onChange(persistedClauses);
    },
    [onChange, toPersistedClauses],
  );

  // Track used field+operator pairs for duplicate prevention
  const usedFieldOperatorPairs = useMemo(() => {
    const set = new Set<string>();
    clauses.forEach((c) => {
      if (c.field && c.operator) {
        set.add(`${c.field}::${c.operator}`);
      }
    });
    return set;
  }, [clauses]);

  const usedFields = useMemo(() => {
    const set = new Set<string>();
    clauses.forEach((c) => {
      if (c.field) {
        set.add(c.field);
      }
    });
    return set;
  }, [clauses]);

  const handleUpdate = useCallback(
    (id: string, updates: Partial<FilterClause>) => {
      const updated = clauses.map((c) =>
        c.id === id ? { ...c, ...updates } : c,
      );
      propagate(updated);
    },
    [clauses, propagate],
  );

  const handleRemove = useCallback(
    (id: string) => {
      const remaining = clauses.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        propagate([makeEmptyClause()]);
      } else {
        propagate(remaining);
      }
    },
    [clauses, propagate],
  );

  const handleAdd = useCallback(() => {
    propagate([...clauses, makeEmptyClause()]);
  }, [clauses, propagate]);

  // Check if we can add more (any unselected field still available)
  const canAddMore = useMemo(() => {
    return usedFields.size < fields.length;
  }, [fields.length, usedFields]);

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%" }}
    >
      {clauses.map((clause, index) => (
        <Box
          key={clause.id}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
            overflowX: "auto",
          }}
        >
          {index > 0 && (
            <Typography
              variant="caption"
              sx={{
                minWidth: 32,
                textAlign: "center",
                color: "text.secondary",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              AND
            </Typography>
          )}
          {index === 0 && clauses.length > 1 && <Box sx={{ minWidth: 32 }} />}
          <ClauseRow
            clause={clause}
            fields={fields}
            usedFields={usedFields}
            usedFieldOperatorPairs={usedFieldOperatorPairs}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            isOnly={clauses.length === 1}
          />
        </Box>
      ))}

      {canAddMore && (
        <Box sx={{ mt: 0.5 }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAdd}
            sx={{ textTransform: "none", color: "text.secondary" }}
          >
            Add filter
          </Button>
        </Box>
      )}
    </Box>
  );
};
const MULTI_VALUE_REFERENCE_AUTOCOMPLETE_SX = MULTI_VALUE_AUTOCOMPLETE_SX;
