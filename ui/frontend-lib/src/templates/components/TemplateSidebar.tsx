import { useCallback, useState } from "react";

import { Box, Chip, Grid, TextField } from "@mui/material";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { InlineCode } from "../../common/components/code/InlineCode";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { MultiSelectEditor } from "../../common/components/editors/MultiSelectEditor";
import { StringChips } from "../../common/components/editors/StringChips";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import { Entity } from "../../common/components/entities/Entity";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { getProviderDisplayName, sameStringSet } from "../../common/utils";
import { solidChipColorSx } from "../../common/utils/softChip";
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

export interface TemplateSidebarProps {
  template: GqlTemplate;
}

/**
 * GitHub-style right sidebar for the template detail page: groups the
 * template's description, status, relations, configuration and history so the
 * main column can focus on its documentation, resources and versions.
 */
export const TemplateSidebar = ({ template }: TemplateSidebarProps) => {
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
    <EntitySidebar ariaLabel="Template details">
      <SidebarSection title="About">
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
              slotProps={{ input: { "aria-label": "Name" } }}
              fullWidth
              margin="normal"
              autoFocus
            />
          )}
          size={12}
        />
        <EditableDescriptionField
          value={template.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableTagsField
          value={template.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <Grid size={12}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <StatusChip status={template.status} />
            {template.abstract && (
              <Chip label="ABSTRACT" sx={solidChipColorSx("info")} />
            )}
          </Box>
        </Grid>
      </SidebarSection>

      <SidebarSection title="Relations">
        <CommonEditableField<string[]>
          name={"Parents"}
          canEdit={canEdit}
          value={template.parents?.map((parent) => parent.id) || []}
          ariaLabel="Edit parents"
          isEqual={sameStringSet}
          display={
            template.parents && template.parents.length > 0 ? (
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
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
              ariaLabel="Parents"
              placeholder="Select parent templates…"
              multiple
            />
          )}
          size={12}
        />
        <CommonEditableField<string[]>
          name={"Children"}
          canEdit={canEdit}
          value={template.children?.map((child) => child.id) || []}
          ariaLabel="Edit children"
          isEqual={sameStringSet}
          display={
            template.children && template.children.length > 0 ? (
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
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
              ariaLabel="Children"
              placeholder="Select child templates…"
              multiple
            />
          )}
          size={12}
        />
      </SidebarSection>

      <SidebarSection title="Configuration">
        <CommonEditableField<string | null>
          name={"Naming Convention"}
          canEdit={canEdit}
          value={template.configuration?.naming_convention ?? null}
          ariaLabel="Edit naming convention"
          display={
            template.configuration?.naming_convention ? (
              <InlineCode>
                {template.configuration.naming_convention}
              </InlineCode>
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
          size={12}
        />
        <TemplateDocumentationField
          documentation={template.documentation}
          canEdit={canEdit}
          onSave={(documentation) => saveField({ documentation })}
          size={12}
        />
        <CommonEditableField<string[]>
          name={"Cloud Resource Types"}
          canEdit={canEdit}
          value={template.cloudResourceTypes || []}
          ariaLabel="Edit cloud resource types"
          isEqual={sameStringSet}
          display={
            template.cloudResourceTypes &&
            template.cloudResourceTypes.length > 0 ? (
              <StringChips values={template.cloudResourceTypes} />
            ) : (
              <PlaceholderText />
            )
          }
          onSave={(value) => saveField({ cloudResourceTypes: value })}
          renderEditor={({ value, onChange }) => (
            <ArrayReferenceInput
              ikApi={ikApi}
              buffer={buffer}
              setBuffer={setBuffer}
              entity_name="cloud_resources"
              value={value}
              onChange={onChange}
              ariaLabel="Cloud Resource Types"
              placeholder="Select cloud resource type…"
              multiple
            />
          )}
          size={12}
        />
        <CommonEditableField<IntegrationProviderType[]>
          name={"Integration Providers for One Resource Per Integration"}
          canEdit={canEdit}
          value={template.configuration?.one_resource_per_integration ?? []}
          ariaLabel="Edit one resource per integration providers"
          isEqual={sameStringSet}
          display={
            (template.configuration?.one_resource_per_integration ?? [])
              .length ? (
              <StringChips
                values={
                  template.configuration?.one_resource_per_integration ?? []
                }
                format={getProviderDisplayName}
              />
            ) : (
              <PlaceholderText />
            )
          }
          onSave={(value) =>
            saveConfiguration({ one_resource_per_integration: value })
          }
          renderEditor={({ value, onChange }) => (
            <MultiSelectEditor<IntegrationProviderType>
              value={value}
              onChange={onChange}
              ariaLabel="Integration Providers to filter on"
              placeholder="Select providers to filter on…"
              helperText="Empty means all providers"
              options={INTEGRATION_PROVIDER_OPTIONS}
              getOptionLabel={getProviderDisplayName}
            />
          )}
          size={12}
        />
        <CommonEditableField<IntegrationProviderType[]>
          name={"Allowed Integration Providers"}
          canEdit={canEdit}
          value={
            template.configuration?.allowed_provider_integration_types ?? []
          }
          ariaLabel="Edit allowed integration providers"
          isEqual={sameStringSet}
          display={
            (template.configuration?.allowed_provider_integration_types ?? [])
              .length ? (
              <StringChips
                values={
                  template.configuration?.allowed_provider_integration_types ??
                  []
                }
                format={getProviderDisplayName}
              />
            ) : (
              <PlaceholderText />
            )
          }
          onSave={(value) =>
            saveConfiguration({ allowed_provider_integration_types: value })
          }
          renderEditor={({ value, onChange }) => (
            <MultiSelectEditor<IntegrationProviderType>
              value={value}
              onChange={onChange}
              ariaLabel="Allowed Integration Providers"
              placeholder="Select allowed providers…"
              helperText="Empty means all providers"
              options={INTEGRATION_PROVIDER_OPTIONS}
              getOptionLabel={getProviderDisplayName}
            />
          )}
          size={12}
        />
        <CommonEditableField<string[]>
          name={"Required Configuration Variables"}
          canEdit={canEdit}
          value={template.configuration?.required_configuration_variables ?? []}
          ariaLabel="Edit required configuration variables"
          isEqual={sameStringSet}
          display={
            (template.configuration?.required_configuration_variables ?? [])
              .length ? (
              <StringChips
                values={
                  template.configuration?.required_configuration_variables ?? []
                }
              />
            ) : (
              <PlaceholderText />
            )
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
          size={12}
        />
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            template.creator ? (
              <Entity entity={{ ...template.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={template.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={template.updatedAt} />}
          size={6}
        />
        <CommonField
          name="Revision"
          value={template.revisionNumber}
          size={12}
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
