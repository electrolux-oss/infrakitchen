import { SyntheticEvent } from "react";

import {
  FormControl,
  Autocomplete,
  TextField,
  Box,
  Typography,
} from "@mui/material";

import { getAutocompleteTextFieldProps } from "../../common/utils/autocompleteInput";
import { useSourceCodeVersionConfigContext } from "../context/SourceCodeVersionConfigContext";
import { GqlSourceCodeVersion } from "../graphql";

export const ReferenceSelector = () => {
  const { handleReferenceChange, references, selectedReferenceId } =
    useSourceCodeVersionConfigContext();
  const hasReferences = references.length > 0;

  const selectedObject =
    references.find((ref) => ref.id === selectedReferenceId) || null;

  const handleAutocompleteChange = (
    _event: SyntheticEvent,
    newValue: GqlSourceCodeVersion | null,
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
          option.sourceCodeVersion || option.sourceCodeBranch || ""
        }
        renderInput={(params) => (
          <TextField
            {...params}
            {...getAutocompleteTextFieldProps(params, {
              inputLabel: {
                shrink: true,
              },
            })}
            label="Inherit from"
            variant="outlined"
            size="small"
          />
        )}
        renderOption={(props, option) => {
          return (
            <li {...props}>
              <Box>
                <Typography variant="body2">
                  {option.sourceCodeVersion || option.sourceCodeBranch}
                </Typography>
                {option.description && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                    }}
                  >
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
