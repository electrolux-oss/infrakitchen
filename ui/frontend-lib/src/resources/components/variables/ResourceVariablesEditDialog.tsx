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
import {
  ResourceResponse,
  ResourceVariableSchema,
  VariableInput,
} from "../../types";
import { buildValidationRuleMaps } from "../../utils/validationRules";

import { ResourceVariableForm } from "./ResourceVariablesForm";

interface VariablesFormData {
  variables: VariableInput[];
}

export interface ResourceVariablesEditDialogProps {
  open: boolean;
  onClose: () => void;
  resource: ResourceResponse;
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

  function getSchemaObject(schemaList: ResourceVariableSchema[]) {
    return schemaList.reduce((acc: Record<string, any>, variable) => {
      acc[variable.name] = variable;
      return acc;
    }, {});
  }

  const loadSchema = useCallback(async () => {
    if (!resource.source_code_version?.id) return;

    try {
      const schemaResponse: ResourceVariableSchema[] =
        await ikApi.getVariableSchema(
          resource.source_code_version.id,
          resource.parents.map((p) => p.id),
        );
      setSchema(schemaResponse);

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
      }
    } catch (error) {
      notifyError(error);
    }
  }, [
    ikApi,
    resource.source_code_version?.id,
    resource.parents,
    resource.template?.id,
  ]);

  useEffect(() => {
    if (open) {
      reset({
        variables: resource.variables as unknown as VariableInput[],
      });
      loadSchema();
    }
  }, [open, resource.variables, reset, loadSchema]);

  const handleSave = useCallback(
    async (data: VariablesFormData) => {
      setSaving(true);
      try {
        await onSave(data.variables);
        onClose();
      } catch {
        // Error surfaced by onSave; keep dialog open
      } finally {
        setSaving(false);
      }
    },
    [onSave, onClose],
  );

  const handleInvalid = useCallback(() => {
    notifyError(new Error("Please fill in all required fields"));
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Input Variables</DialogTitle>
      <DialogContent>
        <FormProvider {...methods}>
          {Array.isArray(schema) && schema.length > 0 && (
            <Table>
              <TableBody>
                {fields.map((field, index) =>
                  schema && getSchemaObject(schema)[field.name] ? (
                    <ResourceVariableForm
                      key={field.id}
                      index={index}
                      edit_mode={!allowFrozenVariableChanges}
                      variable={getSchemaObject(schema)[field.name] || {}}
                      validationSummary={
                        validationRuleSummaryByVariable[field.name] || null
                      }
                      validationRule={
                        validationRuleByVariable[field.name] || null
                      }
                    />
                  ) : null,
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
