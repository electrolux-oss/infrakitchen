import { Control, FieldArrayWithId } from "react-hook-form";

import { Box } from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";

import { SourceConfigForm } from "./SourceConfigForm";

interface ConfigListProps {
  control: Control<any>;
  fields: FieldArrayWithId<any, "configs">[];
}

export const ConfigList = ({ control, fields }: ConfigListProps) => {
  return (
    <PropertyCard title="Configure Variables">
      {fields.map((field, index) => (
        <Box key={`${field.id}`}>
          <SourceConfigForm
            control={control}
            index={index}
            fieldId={field.id}
          />
        </Box>
      ))}
    </PropertyCard>
  );
};
