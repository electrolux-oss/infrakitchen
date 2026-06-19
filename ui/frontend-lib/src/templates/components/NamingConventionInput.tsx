import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  Box,
  Chip,
  CircularProgress,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import {
  GqlSourceConfig,
  GqlSourceOutputConfigTemplate,
  SOURCE_CODE_VERSION_TEMPLATE_CONFIGS_QUERY,
  SOURCE_CODE_VERSION_TEMPLATE_OUTPUTS_QUERY,
} from "../../source_code_versions/graphql";
import {
  SourceOutputConfigTemplateResponse,
  SourceConfigResponse,
} from "../../source_code_versions/types";
import { GqlTemplateShort } from "../graphql";

interface NamingConventionInputProps {
  templateId: string;
  parents?: GqlTemplateShort[];
  value: string | null;
  onChange: (value: string | null) => void;
  error?: boolean;
  helperText?: string;
}

interface ParentOutputGroup {
  parentName: string;
  outputs: SourceOutputConfigTemplateResponse[];
}

export const NamingConventionInput = ({
  templateId,
  parents = [],
  value,
  onChange,
  error,
  helperText,
}: NamingConventionInputProps) => {
  const { ikApi } = useConfig();
  const [configs, setConfigs] = useState<SourceConfigResponse[]>([]);
  const [parentOutputGroups, setParentOutputGroups] = useState<
    ParentOutputGroup[]
  >([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchConfigs = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    try {
      const [configsResponse, ...parentOutputResponses] = await Promise.all([
        ikApi
          .graphqlRequest<{
            sourceCodeVersionTemplateConfigs: GqlSourceConfig[];
          }>(SOURCE_CODE_VERSION_TEMPLATE_CONFIGS_QUERY, {
            templateId,
          })
          .then((response) => response.sourceCodeVersionTemplateConfigs),
        ...parents.map((p) =>
          ikApi
            .graphqlRequest<{
              sourceCodeVersionTemplateOutputs: GqlSourceOutputConfigTemplate[];
            }>(SOURCE_CODE_VERSION_TEMPLATE_OUTPUTS_QUERY, {
              templateId: p.id,
            })
            .then((response) => ({
              parentName: p.name,
              outputs: response.sourceCodeVersionTemplateOutputs,
            }))
            .catch(() => ({
              parentName: p.name,
              outputs: [] as SourceOutputConfigTemplateResponse[],
            })),
        ),
      ]);
      setConfigs(configsResponse as SourceConfigResponse[]);
      setParentOutputGroups(parentOutputResponses as ParentOutputGroup[]);
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  }, [ikApi, templateId, parents]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const handleInsertVariable = useCallback(
    (varName: string) => {
      const el = inputRef.current;
      const token = `{${varName}}`;
      if (!el) {
        onChange((value ?? "") + token);
        return;
      }

      const start = el.selectionStart ?? (value ?? "").length;
      const end = el.selectionEnd ?? (value ?? "").length;
      const current = value ?? "";
      const next = current.slice(0, start) + token + current.slice(end);
      onChange(next || null);

      // Restore focus and move cursor after inserted token
      requestAnimationFrame(() => {
        el.focus();
        const cursor = start + token.length;
        el.setSelectionRange(cursor, cursor);
      });
    },
    [value, onChange],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      onChange(v.length > 0 ? v : null);
    },
    [onChange],
  );

  return (
    <Box sx={{ mt: 1 }}>
      <TextField
        inputRef={inputRef}
        label="Naming Convention Pattern"
        variant="outlined"
        value={value ?? ""}
        onChange={handleChange}
        error={error}
        helperText={
          helperText ??
          "Pattern for resource names. Use {variable_name} as placeholders. E.g. {project}-{env}-{region}"
        }
        fullWidth
        margin="normal"
        slotProps={{
          htmlInput: { "aria-label": "Naming convention pattern" },
        }}
      />

      {/* Available variables */}
      <Box sx={{ mt: 0.5, mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Available variables (click to insert):
        </Typography>
        {loading && (
          <CircularProgress size={14} sx={{ verticalAlign: "middle" }} />
        )}
        {!loading &&
          configs.length === 0 &&
          parentOutputGroups.every((g) => g.outputs.length === 0) && (
            <Typography variant="caption" color="text.disabled">
              No variables found — add source code versions with variable
              configs first.
            </Typography>
          )}

        {/* Own variable configs */}
        {configs.length > 0 && (
          <Box sx={{ mt: 0.5, mb: 0.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.25 }}
            >
              Input variables:
            </Typography>
            <Box sx={{ display: "inline-flex", flexWrap: "wrap", gap: 0.5 }}>
              {configs.map((config) => (
                <Tooltip
                  key={config.name}
                  title={config.description || config.type}
                  placement="top"
                >
                  <Chip
                    label={config.name}
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={() => handleInsertVariable(config.name)}
                    sx={{
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        )}

        {/* Parent output groups */}
        {parentOutputGroups.map(
          (group) =>
            group.outputs.length > 0 && (
              <Box key={group.parentName} sx={{ mt: 0.5, mb: 0.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 0.25 }}
                >
                  Parent <strong>{group.parentName}</strong> outputs:
                </Typography>
                <Box
                  sx={{ display: "inline-flex", flexWrap: "wrap", gap: 0.5 }}
                >
                  {group.outputs.map((output) => (
                    <Tooltip
                      key={output.name}
                      title={output.description || "parent output"}
                      placement="top"
                    >
                      <Chip
                        label={output.name}
                        size="small"
                        variant="outlined"
                        color="secondary"
                        onClick={() => handleInsertVariable(output.name)}
                        sx={{
                          cursor: "pointer",
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            ),
        )}
      </Box>
    </Box>
  );
};
