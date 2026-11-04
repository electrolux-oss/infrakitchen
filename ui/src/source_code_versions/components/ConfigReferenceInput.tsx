import { useEffect, useState } from "react";

import { Control, Controller, useFormContext, useWatch } from "react-hook-form";

import { GradientCircularProgress, useConfig } from "../../common";
import { EntityReference } from "../../common/components/fields/CommonField";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { HeroXMarkIcon } from "../../icons";
import { useSourceCodeVersionConfigContext } from "../../source_code_versions/context/SourceCodeVersionConfigContext";
import { GqlTemplateShort } from "../../templates/graphql";
import {
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from "../../ui";
import {
  SOURCE_CODE_VERSION_TEMPLATE_OUTPUTS_QUERY,
  GqlSourceOutputConfigTemplate,
} from "../graphql";
import {
  SourceConfigUpdateWithId,
  SourceOutputConfigTemplateResponse,
} from "../types";

interface ConfigReferenceInputProps {
  control: Control<any>;
  index: number;
}

interface FormValues {
  configs: SourceConfigUpdateWithId[];
}

export const ConfigReferenceInput = ({
  control,
  index,
}: ConfigReferenceInputProps) => {
  const [template, setTemplate] = useState<GqlTemplateShort | null>(null);
  const [sourceOutputs, setSourceOutputs] = useState<
    SourceOutputConfigTemplateResponse[]
  >([]);
  const [loadingOutputs, setLoadingOutputs] = useState(false);

  const { ikApi } = useConfig();
  const { setValue } = useFormContext<FormValues>();

  const { templates } = useSourceCodeVersionConfigContext();
  const selectedTemplateId = useWatch({
    control,
    name: `configs.${index}.referenceTemplateId`,
  });

  const handleDeleteTemplateSelection = () => {
    setValue(`configs.${index}.referenceTemplateId`, null);
    setValue(`configs.${index}.outputConfigName`, null);
    setTemplate(null);
    setSourceOutputs([]);
  };
  useEffect(() => {
    if (selectedTemplateId) {
      const selectedItem =
        templates?.find((e: GqlTemplateShort) => e.id === selectedTemplateId) ||
        null;
      setTemplate(selectedItem);
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    const fetchSourceOutputs = async () => {
      if (template) {
        try {
          setLoadingOutputs(true);
          const gqlResponse = await ikApi.graphqlRequest<{
            sourceCodeVersionTemplateOutputs: GqlSourceOutputConfigTemplate[];
          }>(SOURCE_CODE_VERSION_TEMPLATE_OUTPUTS_QUERY, {
            templateId: template.id,
          });
          const response = gqlResponse.sourceCodeVersionTemplateOutputs;
          if (response.length > 0) {
            setSourceOutputs(response);
          } else {
            notify("No source code configs found", "info");
          }
        } catch (e) {
          notifyError(e);
        } finally {
          setLoadingOutputs(false);
        }
      }
    };
    fetchSourceOutputs();
  }, [template, ikApi]);

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-2 md:flex-row md:items-start">
      <Controller
        name={`configs.${index}.referenceTemplateId`}
        control={control}
        render={({ field }) => (
          <FormControl fullWidth margin="normal">
            <InputLabel id="template-select-label">
              Reference template (optional)
            </InputLabel>
            <Select
              labelId="template-select-label"
              id="template-select"
              value={field.value || ""}
              onChange={field.onChange}
              renderValue={(value) => {
                const selected = templates.find((e) => e.id === value);
                return selected ? (
                  <EntityReference {...selected} disableLink />
                ) : (
                  ""
                );
              }}
            >
              {templates &&
                templates.map((e: GqlTemplateShort) => (
                  <MenuItem key={e.id} value={e.id}>
                    <EntityReference {...e} disableLink />
                  </MenuItem>
                ))}
            </Select>
            <FormHelperText>
              When a parent resource uses this template, its output pre-fills
              this variable.
            </FormHelperText>
          </FormControl>
        )}
      />
      {loadingOutputs && <GradientCircularProgress />}
      {sourceOutputs.length > 0 && selectedTemplateId && (
        <Controller
          name={`configs.${index}.outputConfigName`}
          control={control}
          render={({ field }) => (
            <FormControl fullWidth margin="normal">
              <InputLabel id="sco-select-label">Reference output</InputLabel>
              <Select
                labelId="sco-select-label"
                id="sco-select"
                value={field.value || ""}
                onChange={field.onChange}
              >
                {sourceOutputs &&
                  sourceOutputs.map((e: SourceOutputConfigTemplateResponse) => (
                    <MenuItem key={e.name} value={e.name}>
                      {e.name}
                    </MenuItem>
                  ))}
              </Select>
              <FormHelperText>
                Output of the parent resource to use as the default value.
              </FormHelperText>
            </FormControl>
          )}
        />
      )}
      {selectedTemplateId && (
        <Tooltip title="Clear reference">
          <IconButton
            className="md:mt-3.5"
            aria-label="Clear reference"
            onClick={handleDeleteTemplateSelection}
          >
            <HeroXMarkIcon />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
};
