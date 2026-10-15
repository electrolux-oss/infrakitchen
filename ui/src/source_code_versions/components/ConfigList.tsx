import { Control, FieldArrayWithId } from "react-hook-form";

import { Spinner } from "../../ui";
import { useSourceCodeVersionConfigContext } from "../context/SourceCodeVersionConfigContext";

import { SourceConfigForm } from "./SourceConfigForm";

interface ConfigListProps {
  control: Control<any>;
  fields: FieldArrayWithId<any, "configs">[];
}

export const ConfigList = ({ control, fields }: ConfigListProps) => {
  const { isLoading } = useSourceCodeVersionConfigContext();

  return (
    <div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner size={28} />
        </div>
      ) : (
        fields.map((field, index) => (
          <div key={`${field.id}`}>
            <SourceConfigForm
              control={control}
              index={index}
              fieldId={field.id}
            />
          </div>
        ))
      )}
    </div>
  );
};
