import AddIcon from "@mui/icons-material/Add";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { GqlIacVariable } from "../../graphql";

export type VariableRow = { name: string; value: string };

export const toRows = (
  variables: Record<string, string> | null | undefined,
): VariableRow[] =>
  Object.entries(variables ?? {}).map(([name, value]) => ({ name, value }));

export const toRecord = (rows: VariableRow[]): Record<string, string> =>
  Object.fromEntries(
    rows
      .filter((row) => row.name.trim())
      .map((row) => [row.name.trim(), row.value]),
  );

interface IacVariablesEditorProps {
  rows: VariableRow[];
  onChange: (rows: VariableRow[]) => void;
  // Variables the modules declare, offered as names
  declared: GqlIacVariable[];
  // Values set one level up (the environment's, for a region)
  inherited?: Record<string, string>;
}

export const IacVariablesEditor = ({
  rows,
  onChange,
  declared,
  inherited = {},
}: IacVariablesEditorProps) => {
  const declaredByName = new Map(declared.map((v) => [v.name, v]));
  const used = new Set(rows.map((row) => row.name));
  const update = (index: number, row: VariableRow) =>
    onChange(rows.map((current, i) => (i === index ? row : current)));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {rows.map((row, index) => {
        const variable = declaredByName.get(row.name);
        const inheritedValue = inherited[row.name];
        return (
          <Box
            key={index}
            sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
          >
            <Autocomplete
              freeSolo
              autoSelect
              size="small"
              sx={{ flex: 2 }}
              options={declared
                .map((v) => v.name)
                .filter((name) => name === row.name || !used.has(name))}
              value={row.name}
              onChange={(_, name) =>
                update(index, { ...row, name: (name ?? "").trim() })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="name"
                  helperText={variable?.description || undefined}
                  slotProps={{
                    ...params.slotProps,
                    htmlInput: {
                      ...params.slotProps.htmlInput,
                      "aria-label": "Variable name",
                    },
                  }}
                />
              )}
            />
            <TextField
              size="small"
              sx={{ flex: 3 }}
              value={row.value}
              onChange={(e) => update(index, { ...row, value: e.target.value })}
              placeholder={
                inheritedValue !== undefined
                  ? `${inheritedValue} (environment)`
                  : (variable?.type ?? "value")
              }
              slotProps={{
                htmlInput: {
                  "aria-label": `Value of ${row.name || "variable"}`,
                },
                input: variable?.sensitive
                  ? {
                      endAdornment: (
                        <Tooltip title="Sensitive: stored as plain text in the environment settings">
                          <LockOutlinedIcon
                            fontSize="small"
                            sx={{ color: "warning.main" }}
                          />
                        </Tooltip>
                      ),
                    }
                  : undefined,
              }}
            />
            <IconButton
              size="small"
              aria-label={`Remove ${row.name || "variable"}`}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              sx={{ mt: 0.5 }}
            >
              <DeleteOutlinedIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
      <Box>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onChange([...rows, { name: "", value: "" }])}
        >
          Add variable
        </Button>
      </Box>
    </Box>
  );
};

interface MissingVariablesProps {
  declared: GqlIacVariable[];
  values: Record<string, string>;
}

// Required variables without a value here; fine when the repository's var files set them.
export const MissingVariables = ({
  declared,
  values,
}: MissingVariablesProps) => {
  const missing = declared
    .filter((v) => v.required && !(v.name in values))
    .map((v) => v.name);
  if (missing.length === 0) return null;
  return (
    <Typography variant="caption" sx={{ color: "text.secondary" }}>
      Required by the modules and not set here: {missing.join(", ")}. Leave them
      out if the repository var files set them.
    </Typography>
  );
};
