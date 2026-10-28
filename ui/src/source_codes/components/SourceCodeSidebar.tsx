import { useState } from "react";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import {
  CommonField,
  getRemoteUrlValue,
  EntityReference,
} from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { StatusLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { ProviderIcon } from "../../icons/Icons";
import { IkEntity } from "../../types";
import { GqlSourceCode } from "../graphql";
import {
  SourceCodeUpdateFieldInput,
  UPDATE_SOURCE_CODE_MUTATION,
} from "../graphql/mutations";

export interface SourceCodeSidebarProps {
  sourceCode: GqlSourceCode;
}

/**
 * Right context sidebar for the code repository detail page: groups the
 * repository's description, status, remote and history so the main column can
 * focus on its commits, tags and branches.
 */
export const SourceCodeSidebar = ({ sourceCode }: SourceCodeSidebarProps) => {
  const { ikApi } = useConfig();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:source_code", "write");

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const saveField = useEntityFieldSaver<SourceCodeUpdateFieldInput>(
    UPDATE_SOURCE_CODE_MUTATION,
    sourceCode.id,
    "Source code",
  );

  return (
    <EntitySidebar ariaLabel="Code repository details">
      <SidebarSection title="About">
        <EditableDescriptionField
          value={sourceCode.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <CommonField
          name="Status"
          value={<StatusLabel status={sourceCode.status} />}
          span="full"
        />
        <EditableTagsField
          value={sourceCode.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Repository">
        <CommonField
          name={"URL"}
          value={
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex">
                <ProviderIcon
                  provider={sourceCode.sourceCodeProvider}
                  size={18}
                />
              </span>
              {getRemoteUrlValue(sourceCode.sourceCodeUrl)}
            </div>
          }
          span="full"
        />
        <CommonField
          name={"Type"}
          value={
            <div className="flex items-center gap-2">
              <ProviderIcon
                provider={sourceCode.sourceCodeLanguage}
                size={18}
              />
              {sourceCode.sourceCodeLanguage}
            </div>
          }
          span="full"
        />
        <CommonField
          name={"Default Branch"}
          value={
            sourceCode.defaultBranch ? (
              sourceCode.defaultBranch
            ) : (
              <PlaceholderText text="Not synced" />
            )
          }
          span="full"
        />
        <CommonEditableField<string | null>
          name={"Integration"}
          canEdit={canEdit}
          value={sourceCode.integration ? sourceCode.integration.id : null}
          ariaLabel="Edit integration"
          display={
            sourceCode.integration ? (
              <EntityReference
                id={sourceCode.integration.id}
                entityName="integration"
                name={sourceCode.integration.name}
                provider={sourceCode.integration.integrationProvider}
              />
            ) : null
          }
          onSave={(value) => saveField({ integrationId: value })}
          renderEditor={({ value, onChange }) => (
            <ReferenceInput
              ikApi={ikApi}
              buffer={buffer}
              setBuffer={setBuffer}
              entity_name="integrations"
              filter={{ integration_type: "git" }}
              value={value}
              onChange={onChange}
              ariaLabel="Integration"
              placeholder="Select integration…"
              helpertext="Select credentials for the source code"
            />
          )}
          span="full"
        />
      </SidebarSection>

      <SidebarDetailsSection entity={sourceCode} />
    </EntitySidebar>
  );
};
