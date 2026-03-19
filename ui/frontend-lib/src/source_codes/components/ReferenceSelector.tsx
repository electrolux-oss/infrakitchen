import { SyntheticEvent } from "react";

import {
  FormControl,
  Autocomplete,
  TextField,
  Box,
  Typography,
} from "@mui/material";

import { useSourceCodeVersionConfigContext } from "../context/SourceCodeVersionConfigContext";
import { SourceCodeVersionResponse } from "../types";

export const ReferenceSelector = () => {
  const { handleReferenceChange, references, selectedReferenceId } =
    useSourceCodeVersionConfigContext();
  const hasReferences = references.length > 0;

  const selectedObject =
    references.find((ref) => ref.id === selectedReferenceId) || null;

  const handleAutocompleteChange = (
    event: SyntheticEvent,
    newValue: SourceCodeVersionResponse | null,
  ) => {
    const newReferenceId = newValue ? newValue.id : "";
    handleReferenceChange(newReferenceId);
  };

  return (
    <FormControl sx={{ minWidth: 250 }} size="small">
      <Autocomplete
        fullWidth
        size="small"
        options={references}
        value={selectedObject}
        onChange={handleAutocompleteChange}
        isOptionEqualToValue={(option, val) => option.id === val.id}
        getOptionLabel={(option) =>
          option.source_code_version || option.source_code_branch || ""
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label="Inherit from"
            variant="outlined"
            size="small"
            InputLabelProps={{ shrink: true }}
          />
        )}
        renderOption={(props, option) => {
          return (
            <li {...props}>
              <Box>
                <Typography variant="body2">
                  {option.source_code_version || option.source_code_branch}
                </Typography>
                {option.description && (
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                )}
              </Box>
            </li>
          );
        }}
        noOptionsText={
          hasReferences
            ? "No matching source code versions"
            : "No source code versions available"
        }
      />
    </FormControl>
  );
};
