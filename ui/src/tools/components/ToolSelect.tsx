import { forwardRef } from "react";

import { useConfig } from "../../common";
import {
  DefaultableSelect,
  type DefaultableSelectProps,
} from "../../common/components/inputs/DefaultableSelect";
import { ProviderIcon } from "../../icons/Icons";
import { TOOLS_QUERY } from "../graphql";
import { Tool, toolLabel, toolStatus, defaultToolLabel } from "../types";

type ToolSelectProps = Omit<
  DefaultableSelectProps<Tool>,
  "loadOptions" | "isSelectable" | "isDefault" | "defaultLabel" | "renderOption"
>;

/**
 * Select of downloaded tofu/terraform tools.
 * An empty value means the global default tool is used,
 * or tofu installed in the worker runtime when no default is set.
 */
export const ToolSelect = forwardRef<HTMLElement, ToolSelectProps>(
  ({ helperText, ...props }, ref) => {
    const { ikApi } = useConfig();
    return (
      <DefaultableSelect<Tool>
        {...props}
        ref={ref}
        loadOptions={() =>
          ikApi
            .graphqlRequest<{ tools: Tool[] }>(TOOLS_QUERY, {
              sort: ["name", "ASC"],
            })
            .then((response) => response.tools)
        }
        isSelectable={(tool) => toolStatus(tool) === "ready"}
        isDefault={(tool) => !!tool.isDefault}
        defaultLabel={defaultToolLabel}
        menuItemClassName="gap-2"
        renderOption={(tool) => (
          <>
            <ProviderIcon provider={tool.name} />
            {toolLabel(tool)}
          </>
        )}
        helperText={
          helperText ??
          "OpenTofu/Terraform version used to run the code. Leave the global default to follow the version set in Settings."
        }
      />
    );
  },
);

ToolSelect.displayName = "ToolSelect";
