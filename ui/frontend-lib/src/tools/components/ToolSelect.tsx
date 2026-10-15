import { forwardRef, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import { ProviderIcon } from "../../icons/Icons";
import { MenuItem, TextField, type TextFieldProps } from "../../ui";
import { TOOLS_QUERY } from "../graphql";
import { Tool, toolLabel, toolStatus, defaultToolLabel } from "../types";

type ToolSelectProps = Omit<TextFieldProps, "onChange" | "value"> & {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
};

/**
 * Select of downloaded tofu/terraform tools.
 * An empty value means the global default tool is used,
 * or tofu installed in the worker runtime when no default is set.
 */
export const ToolSelect = forwardRef<HTMLElement, ToolSelectProps>(
  ({ value, onChange, helperText, selectProps, ...props }, ref) => {
    const { ikApi } = useConfig();
    const [tools, setTools] = useState<Tool[]>([]);
    const [defaultTool, setDefaultTool] = useState<Tool | null>(null);

    useEffect(() => {
      ikApi
        .graphqlRequest<{ tools: Tool[] }>(TOOLS_QUERY, {
          sort: ["name", "ASC"],
        })
        .then((response) => {
          setTools(
            response.tools.filter(
              (tool) => toolStatus(tool) === "ready" || tool.id === value,
            ),
          );
          setDefaultTool(response.tools.find((tool) => tool.isDefault) ?? null);
        })
        .catch(notifyError);
      // value is only used to keep the current selection visible
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ikApi]);

    return (
      <TextField
        {...props}
        ref={ref}
        select
        fullWidth
        size="small"
        margin="dense"
        value={value || ""}
        // the global default option has an empty value, which Select renders as blank unless displayEmpty is set
        selectProps={{ displayEmpty: true, ...selectProps }}
        onChange={(event) => onChange(event.target.value || null)}
        helperText={
          helperText ??
          "OpenTofu/Terraform version used to run the code. Leave the global default to follow the version set in Settings."
        }
      >
        <MenuItem value="">{defaultToolLabel(defaultTool)}</MenuItem>
        {tools.map((tool) => (
          <MenuItem key={tool.id} value={tool.id} className="gap-2">
            <ProviderIcon provider={tool.name} />
            {toolLabel(tool)}
          </MenuItem>
        ))}
      </TextField>
    );
  },
);

ToolSelect.displayName = "ToolSelect";
