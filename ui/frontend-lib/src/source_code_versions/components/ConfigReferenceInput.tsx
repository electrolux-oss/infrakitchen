import { useEffect, useState } from "react";

import { Control, Controller, useFormContext, useWatch } from "react-hook-form";

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Button,
} from "@mui/material";

import { GradientCircularProgress, useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { TemplateShort } from "../../templates/types";
import { useSourceCodeVersionConfigContext } from "../context/SourceCodeVersionConfigContext";
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
  const [template, setTemplate] = useState<TemplateShort | null>(null);
  const [sourceOutputs, setSourceOutputs] = useState<
    SourceOutputConfigTemplateResponse[]
  >([]);
  const [loadingOutputs, setLoadingOutputs] = useState(false);

  const { ikApi } = useConfig();
  const { setValue } = useFormContext<FormValues>();

  const { templates } = useSourceCodeVersionConfigContext();
  const selectedTemplateId = useWatch({
    control,
    name: `configs.${index}.reference_template_id`,
  });

  const handleDeleteTemplateSelection = () => {
    setValue(`configs.${index}.reference_template_id`, null);
    setValue(`configs.${index}.output_config_name`, null);
    setTemplate(null);
    setSourceOutputs([]);
  };
  useEffect(() => {
    if (selectedTemplateId) {
      const selectedItem =
        templates?.find((e: TemplateShort) => e.id === selectedTemplateId) ||
        null;
      setTemplate(selectedItem);
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    const fetchSourceOutputs = async () => {
      if (template) {
        try {
          setLoadingOutputs(true);
          await ikApi
            .get(`source_code_versions/template/${template.id}/outputs`)
            .then((response: SourceOutputConfigTemplateResponse[]) => {
              if (response.length > 0) {
                setSourceOutputs(response);
              } else {
                notify("No source code configs found", "info");
              }
            });
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
    <>
      <Controller
        name={`configs.${index}.reference_template_id`}
        control={control}
        render={({ field }) => (
          <FormControl fullWidth margin="normal">
            <InputLabel id="template-select-label">Select Template</InputLabel>
            <Select
              labelId="template-select-label"
              id="template-select"
              value={field.value || ""}
              onChange={field.onChange}
            >
              {templates &&
                templates.map((e: TemplateShort) => (
                  <MenuItem key={e.id} value={e.id}>
                    {e.name}
                  </MenuItem>
                ))}
            </Select>
            <FormHelperText>
              Select the template to reference. This will be used to fetch the
              output variables.
            </FormHelperText>
          </FormControl>
        )}
      />
      {loadingOutputs && <GradientCircularProgress />}
      {sourceOutputs.length > 0 && selectedTemplateId && (
        <Controller
          name={`configs.${index}.output_config_name`}
          control={control}
          render={({ field }) => (
            <FormControl fullWidth margin="normal">
              <InputLabel id="sco-select-label">
                Select Source Code Output
              </InputLabel>
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
                Select the source code output to reference. This will be used to
                fetch the output variables.
              </FormHelperText>
            </FormControl>
          )}
        />
      )}
      <Button
        variant="outlined"
        onClick={handleDeleteTemplateSelection}
        sx={{ mt: 2 }}
      >
        Clear
      </Button>
    </>
  );
};
