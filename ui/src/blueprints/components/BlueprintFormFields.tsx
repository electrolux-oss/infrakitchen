import { Control, Controller, FieldErrors } from "react-hook-form";

import { LabelInput } from "../../common";
import { WiringRule } from "../../common/components/viewers/Wiring/types";
import { WiringCanvas } from "../../common/components/viewers/Wiring/WiringCanvas";
import { TemplatePorts } from "../../common/components/viewers/Wiring/WiringCanvas.types";
import { GqlTemplateShort } from "../../templates/graphql";
import { TextField } from "../../ui";
import { ConstantBlock, ConstantType, ExternalTemplate } from "../types";

interface BlueprintFormFieldsProps {
  control: Control<any>;
  errors: FieldErrors;
  selectedTemplates: GqlTemplateShort[];
  templatePorts: Record<string, TemplatePorts>;
  currentWiring: WiringRule[];
  missingParentTemplates: ExternalTemplate[];
  externalTemplates: ExternalTemplate[];
  onExternalTemplateAdd: (template: ExternalTemplate) => void;
  onExternalTemplateRemove: (templateId: string) => void;
  constants: ConstantBlock[];
  onConstantAdd: (type: ConstantType, id?: string) => void;
  onConstantRemove: (constantId: string) => void;
  onConstantUpdate: (constantId: string, name: string) => void;
  onConstantDefaultValueUpdate: (
    constantId: string,
    defaultValue: string,
  ) => void;
  onTemplateAdd: (template: GqlTemplateShort) => void;
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
  const details = (
    <>
      <Controller
        name="name"
        control={control}
        rules={{ required: "Name is required" }}
        render={({ field }) => (
          <TextField
            {...field}
            label="Name"
            required
            error={!!errors.name}
            helperText={
              errors.name
                ? (errors.name.message as string)
                : "Name of the blueprint"
            }
            fullWidth
            margin="normal"
            inputProps={{ "aria-label": "Blueprint name" }}
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
            error={!!errors.description}
            helperText={
              errors.description
                ? (errors.description.message as string)
                : "Description of the blueprint"
            }
            fullWidth
            margin="normal"
            multiline
            minRows={3}
            inputProps={{ "aria-label": "Blueprint description" }}
          />
        )}
      />
      <Controller
        name="labels"
        control={control}
        defaultValue={[]}
        render={({ field }) => <LabelInput errors={errors} {...field} />}
      />
    </>
  );

  return (
    <WiringCanvas
      details={details}
      detailsTitle="Blueprint details"
      detailsInvalid={!!(errors.name || errors.description || errors.labels)}
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
  );
};
