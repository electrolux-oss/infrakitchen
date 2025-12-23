import { SyntheticEvent } from "react";

import {
  FormControl,
  InputLabel,
  Autocomplete,
  TextField,
  Box,
  Typography,
} from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";
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
    <PropertyCard
      title="Source Code Version Reference"
      subtitle="Choose a previous configuration of the source code version to fill fields automatically."
    >
      <FormControl fullWidth margin="normal" variant="outlined">
        <InputLabel id="reference-label" shrink>
          Source Code Version Reference
        </InputLabel>
        <Autocomplete
          fullWidth
          options={references}
          value={selectedObject}
          onChange={handleAutocompleteChange}
          isOptionEqualToValue={(option, val) => option.id === val.id}
          getOptionLabel={(option) => option.identifier || ""}
          renderInput={(params) => <TextField {...params} margin="normal" />}
          renderOption={(props, option) => {
            return (
              <li {...props}>
                <Box>
                  <Typography variant="body1">{option.identifier}</Typography>
                  {option.description && (
                    <Typography variant="body2" color="text.secondary">
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
    </PropertyCard>
  );
};
