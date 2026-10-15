import { useState } from "react";

import { useParams } from "react-router";

import TuneIcon from "@mui/icons-material/Tune";
import { Button } from "@mui/material";

import { LogLiveTail, PermissionWrapper } from "../../common";
import { EntityContainer } from "../../common/components/cards/EntityContainer";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
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

  return (
    <>
      <EntityContainer
        title={"Template Version Details"}
        actions={
          sourceCodeVersion?.template?.id ? (
            <PermissionWrapper
              requiredPermission="api:source_code_version"
              permissionAction="write"
            >
              <Button
                startIcon={<TuneIcon />}
                onClick={() => setDialogOpen(true)}
              >
                Manage Versions
              </Button>
            </PermissionWrapper>
          ) : undefined
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
