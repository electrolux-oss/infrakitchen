import { useCallback, useEffect, useState } from "react";

import { useForm } from "react-hook-form";

import { Box, Button } from "@mui/material";

import { WiringRule } from "../../common/components/viewers/Wiring/types";
import { WiringCanvas } from "../../common/components/viewers/Wiring/WiringCanvas";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { useBlueprintForm } from "../hooks/useBlueprintForm";
import { BlueprintResponse, BlueprintUpdateRequest } from "../types";

interface BlueprintWiringEditorProps {
  blueprint: BlueprintResponse;
  onClose: () => void;
}

/**
 * Inline editor for a blueprint's templates and wiring. Mirrors the canvas on
 * the standalone edit page but is embedded in the blueprint detail view and
 * persists changes via REST before refreshing the entity in place.
 */
export const BlueprintWiringEditor = ({
  blueprint,
  onClose,
}: BlueprintWiringEditorProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const [saving, setSaving] = useState(false);

  const { handleSubmit, setValue, watch, reset } =
    useForm<BlueprintUpdateRequest>({
      defaultValues: {
        name: "",
        description: "",
        templateIds: [],
        externalTemplateIds: [],
        wiring: [],
        defaultVariables: {},
        configuration: {},
        labels: [],
      },
      mode: "onChange",
    });

  const form = useBlueprintForm({
    setValue: setValue as any,
    watch: watch as any,
  });

  // Initialise the form + canvas state from the current blueprint.
  useEffect(() => {
    const constantWires: WiringRule[] =
      blueprint.configuration?.constant_wires || [];
    reset({
      name: blueprint.name,
      description: blueprint.description || "",
      templateIds: blueprint.templates.map((t) => t.id),
      wiring: [...blueprint.wiring, ...constantWires],
      defaultVariables: blueprint.default_variables,
      configuration: blueprint.configuration,
      labels: blueprint.labels,
    });

    form.setSelectedTemplates(blueprint.templates);

    const extTemplates = blueprint.external_templates || [];
    if (extTemplates.length > 0) {
      form.setExternalTemplates(extTemplates);
    }

    const savedConstants = blueprint.configuration?.constants || [];
    if (savedConstants.length > 0) {
      form.setConstants(savedConstants);
    }

    const allIds = [
      ...blueprint.templates.map((t) => t.id),
      ...extTemplates.map((ext: { id: string }) => ext.id),
    ];
    if (allIds.length > 0) {
      form.fetchBatchPorts(
        blueprint.templates.map((t) => t.id),
        {
          extraSourceIds: new Set(
            extTemplates.map((ext: { id: string }) => ext.id),
          ),
          skipAutoWire: true, // Use saved wiring
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint.id, reset]);

  const onSubmit = useCallback(
    async (data: BlueprintUpdateRequest) => {
      // Separate constant wires from template wires (backend validates UUIDs in wiring)
      const constantIds = new Set(form.constants.map((c) => c.id));
      const allWiring = data.wiring || [];
      const templateWiring = allWiring.filter(
        (w) => !constantIds.has(w.source_template_id),
      );
      const constantWiring = allWiring.filter((w) =>
        constantIds.has(w.source_template_id),
      );
      const payload = {
        name: data.name,
        description: data.description,
        template_ids: data.templateIds,
        external_template_ids: form.externalTemplates.map((t) => t.id),
        wiring: templateWiring,
        default_variables: data.defaultVariables,
        configuration: {
          ...data.configuration,
          constants: form.constants,
          constant_wires: constantWiring,
        },
        labels: data.labels,
      };

      setSaving(true);
      try {
        const response: BlueprintResponse = await ikApi.patchRaw(
          `blueprints/${blueprint.id}`,
          payload,
        );
        if (response.id) {
          notify("Blueprint updated successfully", "success");
          refreshEntity?.(response);
          onClose();
        }
      } catch (error: any) {
        notifyError(error);
      } finally {
        setSaving(false);
      }
    },
    [
      ikApi,
      blueprint.id,
      form.externalTemplates,
      form.constants,
      refreshEntity,
      onClose,
    ],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <WiringCanvas
        selectedTemplates={form.selectedTemplates}
        wiring={form.currentWiring}
        onWiringChange={(newWiring: WiringRule[]) =>
          setValue("wiring", newWiring)
        }
        templatePorts={form.templatePorts}
        onTemplateAdd={form.handleTemplateAdd}
        onTemplateRemove={form.handleTemplateRemove}
        externalTemplates={form.externalTemplates}
        onExternalTemplateAdd={form.handleExternalTemplateAdd}
        onExternalTemplateRemove={form.handleExternalTemplateRemove}
        constants={form.constants}
        onConstantAdd={form.handleConstantAdd}
        onConstantRemove={form.handleConstantRemove}
        onConstantUpdate={form.handleConstantUpdate}
        onConstantDefaultValueUpdate={form.handleConstantDefaultValueUpdate}
        missingParentTemplates={form.missingParentTemplates}
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button
          variant="outlined"
          color="primary"
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit(onSubmit)}
          disabled={saving}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
};
