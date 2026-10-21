import React, { useCallback, useEffect, useRef, useState } from "react";

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
import { Spinner, Label, Tooltip, TextField } from "../../ui";
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
    <div>
      <TextField
        inputRef={inputRef}
        value={value ?? ""}
        onChange={handleChange}
        error={error}
        helperText={
          helperText ??
          "Pattern for resource names. Use {variable_name} as placeholders. E.g. {project}-{env}-{region}"
        }
        fullWidth
        inputProps={{ "aria-label": "Naming convention pattern" }}
      />
      {/* Available variables */}
      <div className="mt-1 mb-2">
        <span className="mr-2 text-caption text-fg-muted">
          Available variables (click to insert):
        </span>
        {loading && <Spinner className="align-middle" size={14} />}
        {!loading &&
          configs.length === 0 &&
          parentOutputGroups.every((g) => g.outputs.length === 0) && (
            <span className="text-caption text-fg-disabled">
              No variables found — add source code versions with variable
              configs first.
            </span>
          )}

        {/* Own variable configs */}
        {configs.length > 0 && (
          <div className="mt-1 mb-1">
            <span className="mb-0.5 block text-caption text-fg-muted">
              Input variables:
            </span>
            <div className="flex flex-wrap gap-1">
              {configs.map((config) => (
                <Tooltip
                  key={config.name}
                  title={config.description || config.type}
                  placement="top"
                >
                  <Label
                    className="font-mono"
                    label={config.name}
                    tone="primary"
                    onClick={() => handleInsertVariable(config.name)}
                  />
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        {/* Parent output groups */}
        {parentOutputGroups.map(
          (group) =>
            group.outputs.length > 0 && (
              <div className="mt-1 mb-1" key={group.parentName}>
                <span className="mb-0.5 block text-caption text-fg-muted">
                  Parent <strong>{group.parentName}</strong> outputs:
                </span>
                <div className="flex flex-wrap gap-1">
                  {group.outputs.map((output) => (
                    <Tooltip
                      key={output.name}
                      title={output.description || "parent output"}
                      placement="top"
                    >
                      <Label
                        className="font-mono"
                        label={output.name}
                        tone="secondary"
                        onClick={() => handleInsertVariable(output.name)}
                      />
                    </Tooltip>
                  ))}
                </div>
              </div>
            ),
        )}
      </div>
    </div>
  );
};
