import { useCallback, useState } from "react";

import { Box, Divider, TextField } from "@mui/material";

import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { MultiSelectEditor } from "../../common/components/editors/MultiSelectEditor";
import { StringChips } from "../../common/components/editors/StringChips";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import { InlineCode } from "../../common/components/InlineCode";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { getProviderDisplayName, sameStringSet } from "../../common/utils";
import { IkEntity } from "../../types";
import { INTEGRATION_PROVIDER_OPTIONS } from "../constants";
import { GqlTemplate } from "../graphql";
import {
  TemplateUpdateFieldInput,
  UPDATE_TEMPLATE_MUTATION,
} from "../graphql/mutations";
import { IntegrationProviderType, TemplateConfig } from "../types";

import { NamingConventionInput } from "./NamingConventionInput";
import { TemplateDocumentationField } from "./TemplateDocumentationField";

export interface TemplateAboutProps {
  template: GqlTemplate;
}

export const TemplateOverview = ({ template }: TemplateAboutProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:template", "write");

  const [buffer, setBuffer] = useState<Record<string, IkEntity[]>>({});

  const saveField = useCallback(
    async (input: TemplateUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_TEMPLATE_MUTATION, {
          id: template.id,
          input,
        });
        notify("Template updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, template.id, refreshEntity],
  );

  const saveConfiguration = useCallback(
    (partial: Partial<TemplateConfig>) =>
      saveField({
        configuration: {
          ...template.configuration,
          ...partial,
        },
      }),
    [saveField, template.configuration],
  );

  return (
    <OverviewCard
      name={template.name}
      description={template.description || "No description"}
      chip={template.abstract ? "Abstract" : undefined}
    >
      <CommonEditableField<string>
        name={"Name"}
        canEdit={canEdit}
        value={template.name}
        ariaLabel="Edit name"
        display={<span>{template.name}</span>}
        onSave={(value) => saveField({ name: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            label="Name"
            fullWidth
            margin="normal"
            autoFocus
          />
        )}
        size={6}
      />
      <CommonField
        name={"Status"}
        value={<StatusChip status={template.status} />}
        size={6}
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={template.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{template.description || "No description"}</span>}
        onSave={(value) => saveField({ description: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            label="Description"
            fullWidth
            multiline
            minRows={2}
            margin="normal"
            autoFocus
          />
        )}
        size={12}
      />
      <CommonEditableField<string | null>
        name={"Naming Convention"}
        canEdit={canEdit}
        value={template.configuration?.naming_convention ?? null}
        ariaLabel="Edit naming convention"
        display={
          template.configuration?.naming_convention ? (
            <InlineCode>{template.configuration.naming_convention}</InlineCode>
          ) : null
        }
        onSave={(value) => saveConfiguration({ naming_convention: value })}
        renderEditor={({ value, onChange }) => (
          <Box sx={{ width: "100%" }}>
            <NamingConventionInput
              templateId={template.id}
              parents={template.parents || []}
              value={value}
              onChange={onChange}
            />
          </Box>
        )}
        size={6}
      />
      <TemplateDocumentationField
        documentation={template.documentation}
        canEdit={canEdit}
        onSave={(documentation) => saveField({ documentation })}
        size={6}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={template.createdAt} user={template.creator} />
        }
        size={6}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={template.updatedAt} />}
        size={6}
      />
      <CommonEditableField<string[]>
        name={"Labels"}
        canEdit={canEdit}
        value={template.labels || []}
        ariaLabel="Edit labels"
        isEqual={sameStringSet}
        display={<Labels labels={template.labels || []} />}
        onSave={(value) => saveField({ labels: value })}
        renderEditor={({ value, onChange }) => (
          <StringTagEditor
            value={value}
            onChange={onChange}
            label="Labels"
            helperText="Press Enter to add a label"
          />
        )}
        size={12}
      />

      <Box sx={{ width: "100%", my: 1 }}>
        <Divider />
      </Box>

      <CommonEditableField<string[]>
        name={"Parents"}
        canEdit={canEdit}
        value={template.parents?.map((parent) => parent.id) || []}
        ariaLabel="Edit parents"
        isEqual={sameStringSet}
        display={
          template.parents && template.parents.length > 0 ? (
            <Box display="flex" gap={1} flexWrap="wrap">
              {template.parents.map((parent, idx) => (
                <span key={parent.id || idx}>
                  <GetReferenceUrlValue {...parent} />
                </span>
              ))}
            </Box>
          ) : null
        }
        onSave={(value) => saveField({ parents: value })}
        renderEditor={({ value, onChange }) => (
          <ArrayReferenceInput
            ikApi={ikApi}
            buffer={buffer}
            setBuffer={setBuffer}
            entity_name="templates"
            value={value}
            onChange={onChange}
            label="Select Parents"
            multiple
          />
        )}
        size={6}
      />
      <CommonEditableField<string[]>
        name={"Children"}
        canEdit={canEdit}
        value={template.children?.map((child) => child.id) || []}
        ariaLabel="Edit children"
        isEqual={sameStringSet}
        display={
          template.children && template.children.length > 0 ? (
            <Box display="flex" gap={1} flexWrap="wrap">
              {template.children.map((child, idx) => (
                <span key={child.id || idx}>
                  <GetReferenceUrlValue {...child} />
                </span>
              ))}
            </Box>
          ) : null
        }
        onSave={(value) => saveField({ children: value })}
        renderEditor={({ value, onChange }) => (
          <ArrayReferenceInput
            ikApi={ikApi}
            buffer={buffer}
            setBuffer={setBuffer}
            entity_name="templates"
            value={value}
            onChange={onChange}
            label="Select Children"
            multiple
          />
        )}
        size={6}
      />

      <CommonEditableField<string[]>
        name={"Cloud Resource Types"}
        canEdit={canEdit}
        value={template.cloudResourceTypes || []}
        ariaLabel="Edit cloud resource types"
        isEqual={sameStringSet}
        display={<StringChips values={template.cloudResourceTypes || []} />}
        onSave={(value) => saveField({ cloudResourceTypes: value })}
        renderEditor={({ value, onChange }) => (
          <ArrayReferenceInput
            ikApi={ikApi}
            buffer={buffer}
            setBuffer={setBuffer}
            entity_name="cloud_resources"
            value={value}
            onChange={onChange}
            label="Select Cloud Resource Type"
            multiple
          />
        )}
        size={6}
      />
      <CommonEditableField<IntegrationProviderType[]>
        name={"Integration Providers for One Resource Per Integration"}
        canEdit={canEdit}
        value={template.configuration?.one_resource_per_integration ?? []}
        ariaLabel="Edit one resource per integration providers"
        isEqual={sameStringSet}
        display={
          <StringChips
            values={template.configuration?.one_resource_per_integration ?? []}
            format={getProviderDisplayName}
          />
        }
        onSave={(value) =>
          saveConfiguration({ one_resource_per_integration: value })
        }
        renderEditor={({ value, onChange }) => (
          <MultiSelectEditor<IntegrationProviderType>
            value={value}
            onChange={onChange}
            label="Integration Providers to filter on"
            helperText="Empty means all providers"
            options={INTEGRATION_PROVIDER_OPTIONS}
            getOptionLabel={getProviderDisplayName}
          />
        )}
        size={6}
      />

      <CommonEditableField<IntegrationProviderType[]>
        name={"Allowed Integration Providers"}
        canEdit={canEdit}
        value={template.configuration?.allowed_provider_integration_types ?? []}
        ariaLabel="Edit allowed integration providers"
        isEqual={sameStringSet}
        display={
          <StringChips
            values={
              template.configuration?.allowed_provider_integration_types ?? []
            }
            format={getProviderDisplayName}
          />
        }
        onSave={(value) =>
          saveConfiguration({ allowed_provider_integration_types: value })
        }
        renderEditor={({ value, onChange }) => (
          <MultiSelectEditor<IntegrationProviderType>
            value={value}
            onChange={onChange}
            label="Allowed Integration Providers"
            helperText="Empty means all providers"
            options={INTEGRATION_PROVIDER_OPTIONS}
            getOptionLabel={getProviderDisplayName}
          />
        )}
        size={6}
      />
      <CommonEditableField<string[]>
        name={"Required Configuration Variables"}
        canEdit={canEdit}
        value={template.configuration?.required_configuration_variables ?? []}
        ariaLabel="Edit required configuration variables"
        isEqual={sameStringSet}
        display={
          <StringChips
            values={
              template.configuration?.required_configuration_variables ?? []
            }
          />
        }
        onSave={(value) =>
          saveConfiguration({ required_configuration_variables: value })
        }
        renderEditor={({ value, onChange }) => (
          <StringTagEditor
            value={value}
            onChange={onChange}
            label="Required Configuration Variables"
            helperText="Press Enter to add a variable name"
          />
        )}
        size={6}
      />
    </OverviewCard>
  );
};
