import { useEffect, useState } from "react";

import { ControllerRenderProps } from "react-hook-form";

import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  SelectChangeEvent,
} from "@mui/material";

import { useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { SourceOutputConfigResponse, SourceOutputConfigShort } from "../types";
import { SourceCodeVersionResponse } from "../types";

interface ConfigReferenceInputProps {
  field: ControllerRenderProps<any, string>;
  sourceCodeVersions: SourceCodeVersionResponse[];
  reference: SourceOutputConfigShort | null;
}

export const ConfigReferenceInput = ({
  field,
  sourceCodeVersions,
  reference,
}: ConfigReferenceInputProps) => {
  const [scv, setScv] = useState<SourceCodeVersionResponse | null>(null);
  const [sourceOutputs, setSourceOutputs] = useState<
    SourceOutputConfigResponse[]
  >([]);

  const { ikApi } = useConfig();

  const handleEntityChange = (event: SelectChangeEvent<any>) => {
    const selectedId = event.target.value as string;
    const selectedItem =
      sourceCodeVersions?.find(
        (e: SourceCodeVersionResponse) => e.id === selectedId,
      ) || null;
    setScv(selectedItem);
  };

  // Initialize scv from existing reference when sourceCodeVersions are available
  useEffect(() => {
    if (reference && sourceCodeVersions && !scv) {
      const matchingScv = sourceCodeVersions.find(
        (e: SourceCodeVersionResponse) =>
          e.id === reference.source_code_version_id,
      );
      if (matchingScv) {
        setScv(matchingScv);
      }
    }
  }, [reference, sourceCodeVersions, scv]);

  useEffect(() => {
    const fetchSourceOutputs = async () => {
      if (scv) {
        try {
          await ikApi
            .get(`source_code_versions/${scv.id}/outputs`)
            .then((response: SourceOutputConfigResponse[]) => {
              if (response.length > 0) {
                setSourceOutputs(response);
              } else {
                notify("No source code configs found", "info");
                if (reference && reference.source_code_version_id === scv.id) {
                  setSourceOutputs([reference]);
                }
              }
            });
        } catch (e) {
          notifyError(e);
          // If API call fails but we have an existing reference, use it
          if (reference && reference.source_code_version_id === scv.id) {
            setSourceOutputs([reference]);
          }
        }
      }
    };
    fetchSourceOutputs();
  }, [scv, ikApi, reference]);

  return (
    <>
      <FormControl fullWidth margin="normal">
        <InputLabel id="sc-select-label">Select Source Code Version</InputLabel>
        <Select
          labelId="sc-select-label"
          id="sc-select"
          value={
            scv ? scv.id : reference ? reference.source_code_version_id : ""
          }
          onChange={handleEntityChange}
        >
          {sourceCodeVersions &&
            sourceCodeVersions.map((e: SourceCodeVersionResponse) => (
              <MenuItem key={e.id} value={e.id}>
                {e.identifier}
              </MenuItem>
            ))}
        </Select>
        <FormHelperText>
          Select the source code version to reference. This will be used to
          fetch the output variables.
        </FormHelperText>
      </FormControl>
      {sourceOutputs.length > 0 && (
        <FormControl fullWidth margin="normal">
          <InputLabel id="sco-select-label">
            Select Source Code Output
          </InputLabel>
          <Select
            labelId="sco-select-label"
            id="sco-select"
            value={field.value}
            onChange={field.onChange}
          >
            {sourceOutputs &&
              sourceOutputs.map((e: SourceOutputConfigResponse) => (
                <MenuItem key={e.id} value={e.id}>
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
    </>
  );
};
