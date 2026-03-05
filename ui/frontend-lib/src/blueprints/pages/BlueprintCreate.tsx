import { useCallback } from "react";

import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import { Button } from "@mui/material";

import { useConfig } from "../../common/context/ConfigContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { BlueprintFormFields } from "../components/BlueprintFormFields";
import { useBlueprintForm } from "../hooks/useBlueprintForm";
import {
  BlueprintCreateRequest,
  BlueprintResponse,
  WiringRule,
} from "../types";

export const BlueprintCreatePage = () => {
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<BlueprintCreateRequest>({
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

  const onSubmit = useCallback(
    (data: BlueprintCreateRequest) => {
      // Separate constant wires from template wires (backend validates UUIDs in wiring)
      const constantIds = new Set(form.constants.map((c) => c.id));
      const templateWiring = data.wiring.filter(
        (w) => !constantIds.has(w.source_template_id),
      );
      const constantWiring = data.wiring.filter((w) =>
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
        .postRaw("blueprints", payload)
        .then((response: BlueprintResponse) => {
          if (response.id) {
            notify("Blueprint created successfully", "success");
            navigate(`${linkPrefix}blueprints/${response.id}`);
          }
        })
        .catch((error: any) => {
          notifyError(error);
        });
    },
    [ikApi, navigate, linkPrefix, form.externalTemplates, form.constants],
  );

  return (
    <PageContainer
      title="Create Blueprint"
      onBack={() => navigate(`${linkPrefix}blueprints`)}
      backAriaLabel="Back to blueprints"
      bottomActions={
        <>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`${linkPrefix}blueprints`)}
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

BlueprintCreatePage.path = "/blueprints/create";
