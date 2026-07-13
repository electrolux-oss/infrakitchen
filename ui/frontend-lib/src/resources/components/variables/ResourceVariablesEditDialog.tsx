import { useCallback, useEffect, useMemo, useState } from "react";

import { FormProvider, useFieldArray, useForm } from "react-hook-form";

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  Typography,
} from "@mui/material";

import ReferenceInput from "../../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../../common/context";
import { notifyError } from "../../../common/hooks/useNotification";
import { IkEntity, ValidationRule } from "../../../types";
import { ENTITY_STATE } from "../../../utils/constants";
import {
  GqlValidationRulesByVariable,
  transformValidationRulesByVariable,
  VALIDATION_RULES_BY_VARIABLE_FIELDS,
} from "../../../validation_rules/graphql";
import { GqlResource, RESOURCE_VARIABLE_SCHEMA_QUERY } from "../../graphql";
import { ResourceVariableSchema, VariableInput } from "../../types";
import { buildValidationRuleMaps } from "../../utils/validationRules";

import { ResourceVariableForm } from "./ResourceVariablesForm";

interface VariablesFormData {
  variables: VariableInput[];
}

type VariableStatus = "existing" | "new" | "deleted";

export interface ResourceVariablesEditDialogProps {
  open: boolean;
  onClose: () => void;
  resource: GqlResource;
  onSave: (
    variables: VariableInput[],
    sourceCodeVersionId?: string | null,
  ) => Promise<void>;
}

export const ResourceVariablesEditDialog = ({
  open,
  onClose,
  resource,
  onSave,
}: ResourceVariablesEditDialogProps) => {
  const { ikApi } = useConfig();
  const [schema, setSchema] = useState<ResourceVariableSchema[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [variableStatusByName, setVariableStatusByName] = useState<
    Record<string, VariableStatus>
  >({});
  const [validationRuleSummaryByVariable, setValidationRuleSummaryByVariable] =
    useState<Record<string, string>>({});
  const [validationRuleByVariable, setValidationRuleByVariable] = useState<
    Record<string, ValidationRule | null>
  >({});

  // Template version selection state
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const scvFilter = useMemo(
    () =>
      resource.template?.id ? { template_id: resource.template.id } : undefined,
    [resource.template?.id],
  );

  const allowFrozenVariableChanges = resource.state === ENTITY_STATE.PROVISION;

  const effectiveVersionId = selectedVersionId;

  const versionChanged =
    selectedVersionId !== null &&
    selectedVersionId !== resource.sourceCodeVersion?.id;

  const methods = useForm<VariablesFormData>({
    mode: "onChange",
    defaultValues: {
      variables: resource.variables as unknown as VariableInput[],
    },
  });

  const { control, handleSubmit, reset } = methods;
  const { fields } = useFieldArray({ control, name: "variables" });

  const getSchemaObject = useCallback(
    (schemaList: ResourceVariableSchema[]) => {
      return schemaList.reduce(
        (acc: Record<string, ResourceVariableSchema>, variable) => {
          acc[variable.name] = variable;
          return acc;
        },
        {},
      );
    },
    [],
  );
  const schemaObject = getSchemaObject(schema);

  const reconcileVariables = useCallback(
    (schemaList: ResourceVariableSchema[]) => {
      const savedVariables =
        (resource.variables as VariableInput[] | null) || [];
      const savedByName = savedVariables.reduce(
        (acc, variable) => {
          acc[variable.name] = variable;
          return acc;
        },
        {} as Record<string, VariableInput>,
      );
      const schemaByName = getSchemaObject(schemaList);
      const statusByName: Record<string, VariableStatus> = {};

      const mergedVariables = [...schemaList]
        .sort((left, right) => left.index - right.index)
        .map((schemaVariable) => {
          const savedVariable = savedByName[schemaVariable.name];

          statusByName[schemaVariable.name] = savedVariable
            ? "existing"
            : "new";

          return {
            name: schemaVariable.name,
            value: savedVariable ? savedVariable.value : schemaVariable.value,
            sensitive: schemaVariable.sensitive,
            type: schemaVariable.type,
            description: schemaVariable.description,
          } satisfies VariableInput;
        });

      savedVariables.forEach((savedVariable) => {
        if (schemaByName[savedVariable.name]) {
          return;
        }

        statusByName[savedVariable.name] = "deleted";
        mergedVariables.push(savedVariable);
      });

      return { mergedVariables, statusByName };
    },
    [getSchemaObject, resource.variables],
  );

  const loadSchema = useCallback(
    async (versionId: string | null) => {
      if (!versionId) return;

      setLoadingSchema(true);
      try {
        const { resourceVariableSchema } = await ikApi.graphqlRequest<{
          resourceVariableSchema: ResourceVariableSchema[];
        }>(RESOURCE_VARIABLE_SCHEMA_QUERY, {
          sourceCodeVersionId: versionId,
          parentResourceIds: resource.parents?.map((p) => p.id) || [],
        });
        const schemaResponse = resourceVariableSchema.map((variable) => ({
          ...variable,
          description: variable.description || "",
        }));
        setSchema(schemaResponse);

        const { mergedVariables, statusByName } =
          reconcileVariables(schemaResponse);
        reset({ variables: mergedVariables });
        setVariableStatusByName(statusByName);

        // Load validation rules
        const templateId = resource.template?.id;
        if (templateId) {
          const response = await ikApi.graphqlRequest<{
            validationRulesByTemplate: GqlValidationRulesByVariable[];
          }>(
            `query ValidationRulesForVariables($templateId: UUID!) {
              validationRulesByTemplate(templateId: $templateId) {
                ${VALIDATION_RULES_BY_VARIABLE_FIELDS}
              }
            }`,
            { templateId },
          );

          const validationData = response.validationRulesByTemplate.map((vr) =>
            transformValidationRulesByVariable(vr),
          );
          const { summaryByVariable, ruleByVariable } =
            buildValidationRuleMaps(validationData);
          setValidationRuleSummaryByVariable(summaryByVariable);
          setValidationRuleByVariable(ruleByVariable);
        } else {
          setValidationRuleSummaryByVariable({});
          setValidationRuleByVariable({});
        }
      } catch (error) {
        notifyError(error);
      } finally {
        setLoadingSchema(false);
      }
    },
    [ikApi, reconcileVariables, resource.parents, resource.template?.id, reset],
  );

  useEffect(() => {
    if (open) {
      setSelectedVersionId(resource.sourceCodeVersion?.id ?? null);
    }
  }, [open, resource.sourceCodeVersion?.id]);

  useEffect(() => {
    if (open && effectiveVersionId) {
      loadSchema(effectiveVersionId);
    }
  }, [open, effectiveVersionId, loadSchema]);

  const handleSave = useCallback(
    async (data: VariablesFormData) => {
      setSaving(true);
      try {
        const filteredVariables = data.variables
          .filter(
            (variable) => variableStatusByName[variable.name] !== "deleted",
          )
          .map((variable) => ({
            name: variable.name,
            value: variable.value,
            sensitive: variable.sensitive,
            type: variable.type,
            description: variable.description,
          }));

        await onSave(
          filteredVariables,
          versionChanged ? selectedVersionId : undefined,
        );
        onClose();
      } catch {
        // Error surfaced by onSave; keep dialog open
      } finally {
        setSaving(false);
      }
    },
    [onSave, onClose, variableStatusByName, versionChanged, selectedVersionId],
  );

  const handleInvalid = useCallback(() => {
    notifyError(new Error("Please fill in all required fields"));
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Input Variables</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3, mt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Select a template version. Variables will be reconfigured based on
            the selected version&apos;s schema.
          </Typography>
          <ReferenceInput
            ikApi={ikApi}
            entity_name="source_code_versions"
            showFields={["identifier"]}
            fields={["id", "identifier", "status"]}
            buffer={buffer}
            setBuffer={setBuffer}
            getOptionDisabled={(option: any) => option.status !== "done"}
            filter={scvFilter}
            value={selectedVersionId}
            onChange={(value: string | null) => setSelectedVersionId(value)}
            label="Template Version"
          />
        </Box>

        {loadingSchema && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {!loadingSchema && (
          <FormProvider {...methods}>
            {(schema.length > 0 || fields.length > 0) && (
              <Table>
                <TableBody>
                  {fields.map((field, index) =>
                    (() => {
                      const variableStatus = variableStatusByName[field.name];
                      const schemaVariable = schemaObject[field.name] || {
                        name: field.name,
                        type: field.type || "string",
                        description: field.description || "",
                        options: [],
                        required: false,
                        restricted: false,
                        sensitive: field.sensitive || false,
                        frozen: false,
                        unique: false,
                        value: field.value ?? null,
                        index,
                      };

                      return (
                        <ResourceVariableForm
                          key={field.id}
                          index={index}
                          edit_mode={!allowFrozenVariableChanges}
                          variable={schemaVariable}
                          status={variableStatus}
                          validationSummary={
                            variableStatus === "deleted"
                              ? null
                              : validationRuleSummaryByVariable[field.name] ||
                                null
                          }
                          validationRule={
                            variableStatus === "deleted"
                              ? null
                              : validationRuleByVariable[field.name] || null
                          }
                        />
                      );
                    })(),
                  )}
                </TableBody>
              </Table>
            )}
            {!loadingSchema &&
              schema.length === 0 &&
              fields.length === 0 &&
              effectiveVersionId && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2 }}
                >
                  No configurable variables for this template version.
                </Typography>
              )}
          </FormProvider>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit(handleSave, handleInvalid)}
          disabled={saving || loadingSchema || !effectiveVersionId}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
