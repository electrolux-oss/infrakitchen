import { useCallback, useEffect, useState } from "react";

import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";

import { Box, Button, Alert, CircularProgress } from "@mui/material";

import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { BlueprintFormFields } from "../components/BlueprintFormFields";
import { useBlueprintForm } from "../hooks/useBlueprintForm";
import {
  BlueprintResponse,
  BlueprintUpdateRequest,
  WiringRule,
} from "../types";

export const BlueprintEditPage = () => {
  const { blueprint_id } = useParams();
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<BlueprintUpdateRequest>({
    defaultValues: {
      name: "",
      description: "",
      template_ids: [],
      wiring: [],
      default_variables: {},
      configuration: {},
      labels: [],
    },
    mode: "onChange",
  });

  const form = useBlueprintForm({
    ikApi,
    setValue: setValue as any,
    watch: watch as any,
  });

  // ── Load existing blueprint ──────────────────────────────────────────
  useEffect(() => {
    if (!blueprint_id) return;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const bp: BlueprintResponse = await ikApi.get(
          `blueprints/${blueprint_id}`,
        );

        const constantWires = bp.configuration?.constant_wires || [];
        reset({
          name: bp.name,
          description: bp.description || "",
          template_ids: bp.templates.map((t) => t.id),
          wiring: [...bp.wiring, ...constantWires],
          default_variables: bp.default_variables,
          configuration: bp.configuration,
          labels: bp.labels,
        });

        form.setSelectedTemplates(bp.templates);

        // Restore external templates from configuration
        const extTemplates = bp.configuration?.external_templates || [];
        if (extTemplates.length > 0) {
          form.setExternalTemplates(extTemplates);
        }

        // Restore constants from configuration
        const savedConstants = bp.configuration?.constants || [];
        if (savedConstants.length > 0) {
          form.setConstants(savedConstants);
        }

        // Batch-fetch ports & parents for all templates + externals in one call
        const allIds = [
          ...bp.templates.map((t) => t.id),
          ...extTemplates.map((ext: { id: string }) => ext.id),
        ];
        if (allIds.length > 0) {
          form.fetchBatchPorts(
            bp.templates.map((t) => t.id),
            {
              extraSourceIds: new Set(
                extTemplates.map((ext: { id: string }) => ext.id),
              ),
              skipAutoWire: true, // Edit page uses saved wiring
            },
          );
        }
      } catch (e: any) {
        setLoadError(e.message || "Failed to load blueprint");
        notifyError(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprint_id, ikApi, reset]);

  // ── Submit ───────────────────────────────────────────────────────────
  const onSubmit = useCallback(
    (data: BlueprintUpdateRequest) => {
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
        ...data,
        wiring: templateWiring,
        configuration: {
          ...data.configuration,
          external_templates: form.externalTemplates,
          constants: form.constants,
          constant_wires: constantWiring,
        },
      };
      ikApi
        .patchRaw(`blueprints/${blueprint_id}`, payload)
        .then((response: BlueprintResponse) => {
          if (response.id) {
            notify("Blueprint updated successfully", "success");
            navigate(`${linkPrefix}blueprints/${response.id}`);
          }
        })
        .catch((error: any) => {
          notifyError(error);
        });
    },
    [
      ikApi,
      blueprint_id,
      navigate,
      linkPrefix,
      form.externalTemplates,
      form.constants,
    ],
  );

  // ── Loading / Error states ───────────────────────────────────────────
  if (loading) {
    return (
      <PageContainer
        title="Edit Blueprint"
        onBack={() => navigate(`${linkPrefix}blueprints`)}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 300,
          }}
        >
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer
        title="Edit Blueprint"
        onBack={() => navigate(`${linkPrefix}blueprints`)}
      >
        <Alert severity="error" sx={{ width: "100%" }}>
          {loadError}
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Edit Blueprint"
      onBack={() => navigate(`${linkPrefix}blueprints/${blueprint_id}`)}
      backAriaLabel="Back to blueprint"
      bottomActions={
        <>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}blueprints/${blueprint_id}`)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmit(onSubmit)}
          >
            Save
          </Button>
        </>
      }
    >
      <BlueprintFormFields
        ikApi={ikApi}
        control={control}
        errors={errors}
        selectedTemplates={form.selectedTemplates}
        templatePorts={form.templatePorts}
        currentWiring={form.currentWiring}
        missingParentTemplates={form.missingParentTemplates}
        externalTemplates={form.externalTemplates}
        onExternalTemplateAdd={form.handleExternalTemplateAdd}
        onExternalTemplateRemove={form.handleExternalTemplateRemove}
        constants={form.constants}
        onConstantAdd={form.handleConstantAdd}
        onConstantRemove={form.handleConstantRemove}
        onConstantUpdate={form.handleConstantUpdate}
        onTemplateAdd={form.handleTemplateAdd}
        onTemplateRemove={form.handleTemplateRemove}
        onWiringChange={(newWiring: WiringRule[]) =>
          setValue("wiring", newWiring)
        }
      />
    </PageContainer>
  );
};

BlueprintEditPage.path = "/blueprints/:blueprint_id/edit";
