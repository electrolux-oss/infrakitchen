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
import { SourceCodeVersionResponse } from "../types";

interface ReferenceSelectorProps {
  references: SourceCodeVersionResponse[];
  selectedReferenceId: string;
  onReferenceChange: (
    _event: SyntheticEvent,
    newValue: SourceCodeVersionResponse | null,
  ) => void;
}

export const ReferenceSelector = ({
  references,
  selectedReferenceId,
  onReferenceChange,
}: ReferenceSelectorProps) => {
  const hasReferences = references.length > 0;

  const selectedObject =
    references.find((ref) => ref.id === selectedReferenceId) || null;

  const handleAutocompleteChange = (
    event: SyntheticEvent,
    newValue: SourceCodeVersionResponse | null,
  ) => {
    onReferenceChange(event, newValue);
  };

  return (
    <PropertyCard
      title="Source Code Version Reference"
      subtitle="Choose a specific version or branch of the source code version, if needed."
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
          renderInput={(params) => (
            <TextField
              {...params}
              margin="normal"
              InputProps={{
                ...params.InputProps,
                endAdornment: <>{params.InputProps.endAdornment}</>,
              }}
            />
          )}
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
