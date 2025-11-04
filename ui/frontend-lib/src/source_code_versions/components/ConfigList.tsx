import { Control, FieldArrayWithId } from "react-hook-form";

import { Box } from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";
import { SourceCodeVersionResponse } from "../types";

import { SourceConfigForm } from "./SourceConfigForm";

interface ConfigListProps {
  control: Control<any>;
  fields: FieldArrayWithId<any, "configs">[];
  entityId: string;
  sourceCodeVersions: SourceCodeVersionResponse[];
  selectedReferenceId: string;
}

export const ConfigList = ({
  control,
  fields,
  entityId,
  sourceCodeVersions,
  selectedReferenceId,
}: ConfigListProps) => {
  return (
    <PropertyCard title="Configure Variables">
      {fields.map((field, index) => (
        <Box key={`${field.id}-${selectedReferenceId}`}>
          <SourceConfigForm
            control={control}
            index={index}
            fieldId={field.id}
            source_code_version_id={entityId}
            source_code_versions={sourceCodeVersions}
          />
        </Box>
      ))}
    </PropertyCard>
  );
};
