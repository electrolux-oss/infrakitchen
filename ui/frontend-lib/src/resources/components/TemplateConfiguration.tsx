import { useCallback } from "react";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { CodeBlock } from "../../common/components/code/CodeBlock";
import { InlineCode } from "../../common/components/code/InlineCode";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { PendingChangeBadge } from "../../common/components/labels/PendingChangeBadge";
import { useEntityProvider } from "../../common/context/EntityContext";
import { Button, Chip } from "../../ui";
import { GqlResource } from "../graphql";
import { ResourceUpdateFieldInput } from "../graphql/mutations";
import { useResourceFieldEditor } from "../hooks/useResourceFieldEditor";
import { VariableInput, VariableOutput } from "../types";

import { ResourceVariablesEditDialog } from "./variables/ResourceVariablesEditDialog";

export interface TemplateConfigurationProps {
  resource: GqlResource;
  /** Opens the variables / template version edit dialog. */
  onEditVariables: () => void;
}

const formatVariableValue = (value: any) => {
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const getSourceCodeVariables = (
  variables: VariableInput[] | VariableOutput[],
  options?: { showType?: boolean; emptyMessage?: string },
) => {
  const { showType = false, emptyMessage = "No variables found." } =
    options ?? {};

  if (!variables || variables.length === 0) {
    return <PlaceholderText text={emptyMessage} className="mx-6" />;
  }

  return (
    <div className="mr-6 ml-6">
      {[...variables]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((variable) => (
          <div
            className="mb-3 rounded-surface border border-divider p-3"
            key={variable.name}
          >
            {/* From xl up the cards share one row and get narrow, so the name
                and value stack instead of sitting side by side. */}
            <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[7fr_5fr] xl:grid-cols-1">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-caption font-semibold">
                      {variable.name}
                    </span>
                    {showType && (variable as VariableInput).type && (
                      <InlineCode disableCopy>
                        {(variable as VariableInput).type}
                      </InlineCode>
                    )}
                    {variable.sensitive && (
                      <Chip
                        label="sensitive"
                        appearance="solid"
                        color="secondary"
                      />
                    )}
                  </div>
                  {variable.description && (
                    <span className="text-caption text-fg-muted">
                      {variable.description}
                    </span>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <span className="text-caption text-fg-muted">Value</span>
                {variable.sensitive ? (
                  <p className="m-0 text-body2 text-fg-muted italic">
                    Hidden (sensitive)
                  </p>
                ) : variable.value === null || variable.value === undefined ? (
                  <PlaceholderText />
                ) : (
                  <CodeBlock>{formatVariableValue(variable.value)}</CodeBlock>
                )}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
};

/**
 * Variables/template-version edit dialog wired to the resource update
 * mutation. Mounted once at page level so both the Input Variables card and
 * the sidebar's Template Version field can open it from any tab.
 */
export const ResourceVariablesEditor = ({
  resource,
  open,
  onClose,
}: {
  resource: GqlResource;
  open: boolean;
  onClose: () => void;
}) => {
  const { saveField } = useResourceFieldEditor(resource);

  const handleVariablesSave = useCallback(
    async (variables: VariableInput[], sourceCodeVersionId?: string | null) => {
      const input: ResourceUpdateFieldInput = { variables };
      if (sourceCodeVersionId !== undefined) {
        input.sourceCodeVersionId = sourceCodeVersionId;
      }
      await saveField(input);
    },
    [saveField],
  );

  return (
    <ResourceVariablesEditDialog
      open={open}
      onClose={onClose}
      resource={resource}
      onSave={handleVariablesSave}
    />
  );
};

export const TemplateConfiguration = ({
  resource,
  onEditVariables,
}: TemplateConfigurationProps) => {
  const { hasPendingChange } = useEntityProvider();
  const { canEdit } = useResourceFieldEditor(resource);

  // Rendered as sibling cards (no wrapper) so the parent grid can lay them
  // out next to the dependency configuration on wide screens.
  if (resource.abstract !== false) return null;

  return (
    <>
      <BaseCard
        name={
          <div className="flex items-center gap-2">
            {/* Inherit the card-title styling so this header matches the
                    plain-string titles used by the other overview cards. */}
            <span>Input Variables</span>
            <Chip
              label={String(resource.variables?.length ?? 0)}
              appearance="solid"
              color="info"
            />
            {hasPendingChange("variables") && <PendingChangeBadge />}
          </div>
        }
        actions={
          <Button onClick={onEditVariables} disabled={!canEdit}>
            Edit Configuration
          </Button>
        }
      >
        <div className="col-span-full">
          {getSourceCodeVariables(resource.variables as VariableInput[], {
            showType: true,
            emptyMessage: "No input variables.",
          })}
        </div>
      </BaseCard>
      <BaseCard
        name={
          <div className="flex items-center gap-2">
            {/* Inherit the card-title styling so this header matches the
                    plain-string titles used by the other overview cards. */}
            <span>Output Values</span>
            <Chip
              label={String(resource.outputs?.length ?? 0)}
              appearance="solid"
              color="info"
            />
          </div>
        }
      >
        <div className="col-span-full">
          {getSourceCodeVariables(resource.outputs as VariableOutput[], {
            emptyMessage: "No output values.",
          })}
        </div>
      </BaseCard>
    </>
  );
};
