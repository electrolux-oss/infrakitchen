import { useCallback, useState } from "react";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { InlineCode } from "../../common/components/code/InlineCode";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableNameField } from "../../common/components/editors/EditableNameField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { MultiSelectEditor } from "../../common/components/editors/MultiSelectEditor";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import {
  CommonField,
  EntityReference,
} from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import ArrayReferenceInput from "../../common/components/inputs/ArrayReferenceInput";
import { StatusLabel } from "../../common/components/labels";
import { Labels } from "../../common/components/labels/Labels";
import { useConfig } from "../../common/context";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { getProviderDisplayName, sameStringSet } from "../../common/utils";
import { getProviderIcon } from "../../icons/Icons";
import { IkEntity } from "../../types";
import { Label } from "../../ui/Label";
import { INTEGRATION_PROVIDER_OPTIONS } from "../constants";
import { GqlTemplate } from "../graphql";
import {
  TemplateUpdateFieldInput,
  UPDATE_TEMPLATE_MUTATION,
} from "../graphql/mutations";
import { IntegrationProviderType, TemplateConfig } from "../types";

import { NamingConventionInput } from "./NamingConventionInput";
import { TemplateDocumentationField } from "./TemplateDocumentationField";

/** Integration providers as label pills with their brand icon. */
const ProviderLabels = ({ providers }: { providers: string[] }) => (
  <div className="flex flex-wrap gap-1">
    {providers.map((provider) => {
      const ProviderIconComponent = getProviderIcon(provider);
      return (
        <Label
          key={provider}
          label={getProviderDisplayName(provider)}
          icon={<ProviderIconComponent className="size-[1em]" />}
        />
      );
    })}
  </div>
);

export interface TemplateSidebarProps {
  template: GqlTemplate;
}

/**
 * Right context sidebar for the template detail page: groups the
 * template's description, status, relations, configuration and history so the
 * main column can focus on its documentation, resources and versions.
 */
export const TemplateSidebar = ({ template }: TemplateSidebarProps) => {
  const { ikApi } = useConfig();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:template", "write");

  const [buffer, setBuffer] = useState<Record<string, IkEntity[]>>({});

  const saveField = useEntityFieldSaver<TemplateUpdateFieldInput>(
    UPDATE_TEMPLATE_MUTATION,
    template.id,
    "Template",
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
        <EditableNameField
          value={template.name}
          canEdit={canEdit}
          onSave={(value) => saveField({ name: value })}
        />
        <EditableDescriptionField
          value={template.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <CommonField
          name="Status"
          value={<StatusLabel status={template.status} />}
          span="full"
        />
        <EditableTagsField
          value={template.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
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
            <div className="w-full">
              <NamingConventionInput
                templateId={template.id}
                parents={template.parents || []}
                value={value}
                onChange={onChange}
              />
            </div>
          )}
          span="full"
        />
        <TemplateDocumentationField
          documentation={template.documentation}
          canEdit={canEdit}
          onSave={(documentation) => saveField({ documentation })}
          span="full"
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
              <Labels margins={false} labels={template.cloudResourceTypes} />
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
          span="full"
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
              <ProviderLabels
                providers={
                  template.configuration?.one_resource_per_integration ?? []
                }
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
          span="full"
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
              <ProviderLabels
                providers={
                  template.configuration?.allowed_provider_integration_types ??
                  []
                }
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
          span="full"
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
              <Labels
                margins={false}
                labels={
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
          span="full"
        />
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
              <div className="flex flex-wrap gap-1">
                {template.parents.map((parent, idx) => (
                  <EntityReference key={parent.id || idx} {...parent} />
                ))}
              </div>
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
          span="full"
        />
        <CommonEditableField<string[]>
          name={"Children"}
          canEdit={canEdit}
          value={template.children?.map((child) => child.id) || []}
          ariaLabel="Edit children"
          isEqual={sameStringSet}
          display={
            template.children && template.children.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {template.children.map((child, idx) => (
                  <EntityReference key={child.id || idx} {...child} />
                ))}
              </div>
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
          span="full"
        />
      </SidebarSection>

      <SidebarDetailsSection entity={template} />
    </EntitySidebar>
  );
};
