import { Control, Controller, FieldErrors } from "react-hook-form";

import { TextField, Box } from "@mui/material";

import { LabelInput } from "../../common";
import { PropertyCard } from "../../common/components/PropertyCard";
import { WiringRule } from "../../common/components/viewers/Wiring/types";
import {
  TemplatePorts,
  WiringCanvas,
} from "../../common/components/viewers/Wiring/WiringCanvas";
import { TemplateShort } from "../../templates/types";
import { ConstantBlock, ConstantType, ExternalTemplate } from "../types";

interface BlueprintFormFieldsProps {
  control: Control<any>;
  errors: FieldErrors;
  selectedTemplates: TemplateShort[];
  templatePorts: Record<string, TemplatePorts>;
  currentWiring: WiringRule[];
  missingParentTemplates: ExternalTemplate[];
  externalTemplates: ExternalTemplate[];
  onExternalTemplateAdd: (template: ExternalTemplate) => void;
  onExternalTemplateRemove: (templateId: string) => void;
  constants: ConstantBlock[];
  onConstantAdd: (type: ConstantType) => void;
  onConstantRemove: (constantId: string) => void;
  onConstantUpdate: (constantId: string, name: string) => void;
  onConstantDefaultValueUpdate: (
    constantId: string,
    defaultValue: string,
  ) => void;
  onTemplateAdd: (template: TemplateShort) => void;
  onTemplateRemove: (templateId: string) => void;
  onWiringChange: (wiring: WiringRule[]) => void;
}

export const BlueprintFormFields = ({
  control,
  errors,
  selectedTemplates,
  templatePorts,
  currentWiring,
  missingParentTemplates,
  externalTemplates,
  onExternalTemplateAdd,
  onExternalTemplateRemove,
  constants,
  onConstantAdd,
  onConstantRemove,
  onConstantUpdate,
  onConstantDefaultValueUpdate,
  onTemplateAdd,
  onTemplateRemove,
  onWiringChange,
}: BlueprintFormFieldsProps) => {
  return (
    <>
      <PropertyCard title="Blueprint Definition">
        <Box>
          <Controller
            name="name"
            control={control}
            rules={{ required: "Name is required" }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Name"
                variant="outlined"
                error={!!errors.name}
                helperText={
                  errors.name
                    ? (errors.name.message as string)
                    : "Name of the blueprint"
                }
                fullWidth
                margin="normal"
                slotProps={{
                  htmlInput: { "aria-label": "Blueprint name" },
                }}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Description"
                variant="outlined"
                error={!!errors.description}
                helperText={
                  errors.description
                    ? (errors.description.message as string)
                    : "Description of the blueprint"
                }
                fullWidth
                margin="normal"
                multiline
                minRows={2}
                slotProps={{
                  htmlInput: { "aria-label": "Blueprint description" },
                }}
              />
            )}
          />

          <Controller
            name="labels"
            control={control}
            defaultValue={[]}
            render={({ field }) => <LabelInput errors={errors} {...field} />}
          />
        </Box>
      </PropertyCard>

      <PropertyCard
        title="Templates & Wiring"
        subtitle="Drag templates from the sidebar onto the canvas, then wire outputs to inputs."
      >
        <WiringCanvas
          selectedTemplates={selectedTemplates}
          wiring={currentWiring}
          onWiringChange={onWiringChange}
          templatePorts={templatePorts}
          onTemplateAdd={onTemplateAdd}
          onTemplateRemove={onTemplateRemove}
          externalTemplates={externalTemplates}
          onExternalTemplateAdd={onExternalTemplateAdd}
          onExternalTemplateRemove={onExternalTemplateRemove}
          constants={constants}
          onConstantAdd={onConstantAdd}
          onConstantRemove={onConstantRemove}
          onConstantUpdate={onConstantUpdate}
          onConstantDefaultValueUpdate={onConstantDefaultValueUpdate}
          missingParentTemplates={missingParentTemplates}
        />
      </PropertyCard>
    </>
  );
};
