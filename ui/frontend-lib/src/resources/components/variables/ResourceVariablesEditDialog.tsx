import { useCallback, useEffect, useState } from "react";

import { FormProvider, useFieldArray, useForm } from "react-hook-form";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
} from "@mui/material";

import { useConfig } from "../../../common/context";
import { notifyError } from "../../../common/hooks/useNotification";
import { ValidationRule } from "../../../types";
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
  onSave: (variables: VariableInput[]) => Promise<void>;
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
  const [variableStatusByName, setVariableStatusByName] = useState<
    Record<string, VariableStatus>
  >({});
  const [validationRuleSummaryByVariable, setValidationRuleSummaryByVariable] =
    useState<Record<string, string>>({});
  const [validationRuleByVariable, setValidationRuleByVariable] = useState<
    Record<string, ValidationRule | null>
  >({});

  const allowFrozenVariableChanges = resource.state === ENTITY_STATE.PROVISION;

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

  const loadSchema = useCallback(async () => {
    if (!resource.sourceCodeVersion?.id) return;

    try {
      const { resourceVariableSchema } = await ikApi.graphqlRequest<{
        resourceVariableSchema: ResourceVariableSchema[];
      }>(RESOURCE_VARIABLE_SCHEMA_QUERY, {
        sourceCodeVersionId: resource.sourceCodeVersion.id,
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
    }
  }, [
    ikApi,
    reconcileVariables,
    resource.sourceCodeVersion?.id,
    resource.parents,
    resource.template?.id,
    reset,
  ]);

  useEffect(() => {
    if (open) {
      loadSchema();
    }
  }, [open, loadSchema]);

  const handleSave = useCallback(
    async (data: VariablesFormData) => {
      setSaving(true);
      try {
        await onSave(
          data.variables
            .filter(
              (variable) => variableStatusByName[variable.name] !== "deleted",
            )
            .map((variable) => ({
              name: variable.name,
              value: variable.value,
              sensitive: variable.sensitive,
              type: variable.type,
              description: variable.description,
            })),
        );
        onClose();
      } catch {
        // Error surfaced by onSave; keep dialog open
      } finally {
        setSaving(false);
      }
    },
    [onSave, onClose, variableStatusByName],
  );

  const handleInvalid = useCallback(() => {
    notifyError(new Error("Please fill in all required fields"));
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Input Variables</DialogTitle>
      <DialogContent>
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
        </FormProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit(handleSave, handleInvalid)}
          disabled={saving}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
