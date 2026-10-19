import { useState } from "react";

import { useParams } from "react-router";

import { LogLiveTail, PermissionWrapper } from "../../common";
import { EntityRefreshButton } from "../../common/components/buttons/EntityRefreshButton";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import { EntityStatusChip } from "../../common/components/labels/EntityStatusChip";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { HeroAdjustmentsHorizontalIcon } from "../../icons";
import { HeroShareIcon, HeroTagIcon } from "../../icons";
import { Button, Label } from "../../ui";
import { TASK_QUEUE_STATUS_SELECTION } from "../../workers/graphql";
import { SourceCodeVersionContent } from "../components/SourceCodeVersionContent";
import { TemplateVersionReorderDialog } from "../components/TemplateVersionReorderDialog";
import { GqlSourceCodeVersion, SCV_DETAIL_FIELDS } from "../graphql";

// Queue state is fetched with the entity in the same request
const PAGE_FIELDS = `${SCV_DETAIL_FIELDS}${TASK_QUEUE_STATUS_SELECTION}`;

export const SourceCodeVersionPage = () => {
  const { source_code_version_id } = useParams();

  return (
    <EntityProvider
      entity_name="sourceCodeVersion"
      entity_id={source_code_version_id || ""}
      entityFields={PAGE_FIELDS}
    >
      <SourceCodeVersionPageContent />
    </EntityProvider>
  );
};

const SourceCodeVersionPageContent = () => {
  const { entity, refreshEntity } = useEntityProvider();
  const sourceCodeVersion = entity as GqlSourceCodeVersion | undefined;
  const [dialogOpen, setDialogOpen] = useState(false);

  // The identifier ("repo/folder/:tag") is unwieldy as a heading; lead with the
  // template name and show the git ref and status next to it.
  const templateName = sourceCodeVersion?.template?.name;
  const gitRef =
    sourceCodeVersion?.sourceCodeVersion || sourceCodeVersion?.sourceCodeBranch;

  return (
    <>
      <EntityContainer
        title={templateName}
        titleIcon={<HeroTagIcon />}
        titleAdornment={
          sourceCodeVersion && templateName ? (
            <>
              {gitRef && (
                <Label
                  label={gitRef}
                  size="large"
                  icon={
                    sourceCodeVersion.sourceCodeVersion ? (
                      <HeroTagIcon />
                    ) : (
                      <HeroShareIcon />
                    )
                  }
                />
              )}
              {sourceCodeVersion.status && (
                <EntityStatusChip status={sourceCodeVersion.status} />
              )}
            </>
          ) : undefined
        }
        actions={
          <>
            {sourceCodeVersion?.template?.id ? (
              <PermissionWrapper
                requiredPermission="api:source_code_version"
                permissionAction="write"
              >
                <Button
                  startIcon={<HeroAdjustmentsHorizontalIcon />}
                  onClick={() => setDialogOpen(true)}
                >
                  Manage Versions
                </Button>
              </PermissionWrapper>
            ) : null}
            <EntityRefreshButton />
          </>
        }
      >
        <SourceCodeVersionContent />
        <LogLiveTail />
      </EntityContainer>
      {sourceCodeVersion?.template?.id ? (
        <TemplateVersionReorderDialog
          open={dialogOpen}
          templateId={sourceCodeVersion.template.id}
          templateName={sourceCodeVersion.template.name}
          onClose={() => setDialogOpen(false)}
          onSaved={() => refreshEntity?.()}
        />
      ) : null}
    </>
  );
};

SourceCodeVersionPage.path = "/source_code_versions/:source_code_version_id";
