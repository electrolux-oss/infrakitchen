import { useState } from "react";

import { Entity, IconField } from "../../common";
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
} from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import StatusChip from "../../common/StatusChip";
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
 * GitHub-style right sidebar for the code repository detail page: groups the
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
        <EditableTagsField
          value={sourceCode.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <div className="col-span-full">
          <StatusChip status={sourceCode.status} />
        </div>
      </SidebarSection>

      <SidebarSection title="Repository">
        <CommonField
          name={"URL"}
          value={
            <div className="flex items-center gap-2">
              {IconField(sourceCode.sourceCodeProvider)}
              {getRemoteUrlValue(sourceCode.sourceCodeUrl)}
            </div>
          }
          span="full"
        />
        <CommonField
          name={"Type"}
          value={
            <div className="flex items-center gap-2">
              {IconField(sourceCode.sourceCodeLanguage)}
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
              <Entity entity={sourceCode.integration} providerIconSize={24} />
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
