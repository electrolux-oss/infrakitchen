import { Control, Controller, FieldErrors } from "react-hook-form";

import { TextField, Box } from "@mui/material";

import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import { LabelInput } from "../../common";
import { PropertyCard } from "../../common/components/PropertyCard";
import { TemplateShort } from "../../templates/types";
import { WiringRule } from "../types";

import {
  TemplatePorts,
  WiringCanvas,
  ExternalTemplate,
  ConstantBlock,
} from "./WiringCanvas";

interface BlueprintFormFieldsProps {
  ikApi: InfraKitchenApi;
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
  onConstantAdd: () => void;
  onConstantRemove: (constantId: string) => void;
  onConstantUpdate: (constantId: string, name: string) => void;
  onTemplateAdd: (template: TemplateShort) => void;
  onTemplateRemove: (templateId: string) => void;
  onWiringChange: (wiring: WiringRule[]) => void;
}

export const BlueprintFormFields = ({
  ikApi,
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
  onTemplateAdd,
  onTemplateRemove,
  onWiringChange,
}: BlueprintFormFieldsProps) => {
  return (
    <>
      {/* ── Basic info ──────────────────────────────────────────────── */}
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

      {/* ── Wiring canvas (with template sidebar) ───────────────────── */}
      <PropertyCard
        title="Templates & Wiring"
        subtitle="Drag templates from the sidebar onto the canvas, then wire outputs to inputs."
      >
        <WiringCanvas
          ikApi={ikApi}
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
          missingParentTemplates={missingParentTemplates}
        />
      </PropertyCard>
    </>
  );
};
