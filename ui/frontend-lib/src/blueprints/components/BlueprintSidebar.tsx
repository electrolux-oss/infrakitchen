import { useNavigate } from "react-router";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableNameField } from "../../common/components/editors/EditableNameField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { Entity } from "../../common/components/entities/Entity";
import { useConfig } from "../../common/context/ConfigContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import StatusChip from "../../common/StatusChip";
import { StorageIcon, TuneIcon } from "../../icons/material";
import { Chip } from "../../ui";
import { GqlBlueprint, UPDATE_BLUEPRINT_MUTATION } from "../graphql";
import { BlueprintUpdateFieldInput } from "../graphql/mutations";

export interface BlueprintSidebarProps {
  blueprint: GqlBlueprint;
}

/**
 * GitHub-style right sidebar for the blueprint detail page: groups the
 * blueprint's description, status, building blocks and history so the main
 * column can focus on its wiring and workflows.
 */
export const BlueprintSidebar = ({ blueprint }: BlueprintSidebarProps) => {
  const { linkPrefix } = useConfig();
  const { checkActionPermission } = usePermissionProvider();
  const navigate = useNavigate();

  const canEdit = checkActionPermission("api:blueprint", "write");

  const saveField = useEntityFieldSaver<BlueprintUpdateFieldInput>(
    UPDATE_BLUEPRINT_MUTATION,
    blueprint.id,
    "Blueprint",
  );

  const externalTemplates = blueprint.externalTemplates || [];

  const constants =
    (blueprint.configuration?.constants as Array<{
      id: string;
      name: string;
    }>) || [];

  return (
    <EntitySidebar ariaLabel="Blueprint details">
      <SidebarSection title="About">
        <EditableNameField
          value={blueprint.name}
          canEdit={canEdit}
          onSave={(value) => saveField({ name: value })}
        />
        <EditableDescriptionField
          value={blueprint.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableTagsField
          value={blueprint.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <div className="col-span-full">
          <StatusChip status={blueprint.status} />
        </div>
      </SidebarSection>

      <SidebarSection title="Templates" count={blueprint.templates.length}>
        <div className="col-span-full">
          <div className="flex flex-col gap-2">
            {blueprint.templates.map((t) => (
              <Entity key={t.id} entity={t} />
            ))}
          </div>
        </div>
      </SidebarSection>

      {externalTemplates.length > 0 && (
        <SidebarSection
          title="Input Templates"
          count={externalTemplates.length}
        >
          <div className="col-span-full">
            <div className="flex flex-wrap gap-2">
              {externalTemplates.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  variant="outlined"
                  color="warning"
                  icon={<StorageIcon />}
                  onClick={() => navigate(`${linkPrefix}templates/${t.id}`)}
                />
              ))}
            </div>
          </div>
        </SidebarSection>
      )}

      {constants.length > 0 && (
        <SidebarSection title="Constants" count={constants.length}>
          <div className="col-span-full">
            <div className="flex flex-wrap gap-2">
              {constants.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  variant="outlined"
                  color="secondary"
                  icon={<TuneIcon />}
                />
              ))}
            </div>
          </div>
        </SidebarSection>
      )}

      <SidebarDetailsSection entity={blueprint} />
    </EntitySidebar>
  );
};
