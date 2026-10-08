import { useCallback } from "react";

import { Box, Button, Chip, Grid, Typography } from "@mui/material";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { CodeBlock } from "../../common/components/code/CodeBlock";
import { InlineCode } from "../../common/components/code/InlineCode";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { PendingChangeBadge } from "../../common/components/labels/PendingChangeBadge";
import { useEntityProvider } from "../../common/context/EntityContext";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { solidChipColorSx } from "../../common/utils/softChip";
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
    return <PlaceholderText text={emptyMessage} sx={{ ml: 3, mr: 3 }} />;
  }

  return (
    <Box sx={{ ml: 3, mr: 3 }}>
      {[...variables]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((variable) => (
          <Box
            key={variable.name}
            sx={{
              border: 1,
              borderColor: "divider",
              borderRadius: "var(--template-surface-radius)",
              p: 1.5,
              mb: 1.5,
            }}
          >
            {/* From xl up the cards share one row and get narrow, so the name
                and value stack instead of sitting side by side. */}
            <Grid container spacing={2} sx={{ alignItems: "center" }}>
              <Grid size={{ xs: 12, md: 7, xl: 12 }}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.5,
                    minWidth: 0,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.75,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 600, fontFamily: CODE_FONT_FAMILY }}
                    >
                      {variable.name}
                    </Typography>
                    {showType && (variable as VariableInput).type && (
                      <InlineCode disableCopy>
                        {(variable as VariableInput).type}
                      </InlineCode>
                    )}
                    {variable.sensitive && (
                      <Chip
                        label="sensitive"
                        sx={solidChipColorSx("secondary")}
                      />
                    )}
                  </Box>
                  {variable.description && (
                    <Typography
                      variant="caption"
                      sx={{ color: "text.secondary" }}
                    >
                      {variable.description}
                    </Typography>
                  )}
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 5, xl: 12 }}>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Value
                </Typography>
                {variable.sensitive ? (
                  <Typography
                    variant="body2"
                    sx={{ color: "text.secondary", fontStyle: "italic" }}
                  >
                    Hidden (sensitive)
                  </Typography>
                ) : variable.value === null || variable.value === undefined ? (
                  <PlaceholderText />
                ) : (
                  <CodeBlock>{formatVariableValue(variable.value)}</CodeBlock>
                )}
              </Grid>
            </Grid>
          </Box>
        ))}
    </Box>
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {/* Inherit the card-title styling so this header matches the
                    plain-string titles used by the other overview cards. */}
            <Typography component="span" variant="inherit">
              Input Variables
            </Typography>
            <Chip
              label={String(resource.variables?.length ?? 0)}
              sx={solidChipColorSx("info")}
            />
            {hasPendingChange("variables") && <PendingChangeBadge />}
          </Box>
        }
        actions={
          <Button onClick={onEditVariables} disabled={!canEdit}>
            Edit Configuration
          </Button>
        }
      >
        <Grid size={12}>
          {getSourceCodeVariables(resource.variables as VariableInput[], {
            showType: true,
            emptyMessage: "No input variables.",
          })}
        </Grid>
      </BaseCard>
      <BaseCard
        name={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {/* Inherit the card-title styling so this header matches the
                    plain-string titles used by the other overview cards. */}
            <Typography component="span" variant="inherit">
              Output Values
            </Typography>
            <Chip
              label={String(resource.outputs?.length ?? 0)}
              sx={solidChipColorSx("info")}
            />
          </Box>
        }
      >
        <Grid size={12}>
          {getSourceCodeVariables(resource.outputs as VariableOutput[], {
            emptyMessage: "No output values.",
          })}
        </Grid>
      </BaseCard>
    </>
  );
};
