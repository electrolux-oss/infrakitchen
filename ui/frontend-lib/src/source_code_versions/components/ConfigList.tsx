import { Control, FieldArrayWithId } from "react-hook-form";

import { Box, CircularProgress } from "@mui/material";

import { PropertyCard } from "../../common/components/PropertyCard";
import { useSourceCodeVersionConfigContext } from "../context/SourceCodeVersionConfigContext";

import { SourceConfigForm } from "./SourceConfigForm";

interface ConfigListProps {
  control: Control<any>;
  fields: FieldArrayWithId<any, "configs">[];
}

export const ConfigList = ({ control, fields }: ConfigListProps) => {
  const { isLoading } = useSourceCodeVersionConfigContext();

  return (
    <PropertyCard title="Configure Variables">
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        fields.map((field, index) => (
          <Box key={`${field.id}`}>
            <SourceConfigForm
              control={control}
              index={index}
              fieldId={field.id}
            />
          </Box>
        ))
      )}
    </PropertyCard>
  );
};
