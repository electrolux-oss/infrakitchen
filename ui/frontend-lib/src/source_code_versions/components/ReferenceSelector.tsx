import { SyntheticEvent } from "react";

import { Autocomplete, FormControl } from "../../ui";
import { useSourceCodeVersionConfigContext } from "../context/SourceCodeVersionConfigContext";
import { GqlSourceCodeVersion } from "../graphql";

export const ReferenceSelector = () => {
  const { handleReferenceChange, references, selectedReferenceId } =
    useSourceCodeVersionConfigContext();
  const hasReferences = references.length > 0;

  const selectedObject =
    references.find((ref) => ref.id === selectedReferenceId) || null;

  const handleAutocompleteChange = (
    _event: SyntheticEvent | null,
    newValue: GqlSourceCodeVersion | null,
  ) => {
    const newReferenceId = newValue ? newValue.id : "";
    handleReferenceChange(newReferenceId);
  };

  return (
    <FormControl className="min-w-62.5" size="small">
      <Autocomplete
        fullWidth
        options={references}
        value={selectedObject}
        onChange={handleAutocompleteChange}
        isOptionEqualToValue={(option, val) => option.id === val.id}
        getOptionLabel={(option) =>
          option.sourceCodeVersion || option.sourceCodeBranch || ""
        }
        renderOption={(option) => (
          <div>
            <p className="m-0 text-body2">
              {option.sourceCodeVersion || option.sourceCodeBranch}
            </p>
            {option.description && (
              <span className="text-caption text-fg-muted">
                {option.description}
              </span>
            )}
          </div>
        )}
        noOptionsText={
          hasReferences
            ? "No matching source code versions"
            : "No source code versions available"
        }
        label="Inherit from"
      />
    </FormControl>
  );
};
