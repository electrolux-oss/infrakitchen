import { useState } from "react";

import { useParams } from "react-router";

import ReorderIcon from "@mui/icons-material/Reorder";
import { Button } from "@mui/material";

import { LogLiveTail, PermissionWrapper } from "../../common";
import { EntityContainer } from "../../common/components/EntityContainer";
import {
  EntityProvider,
  useEntityProvider,
} from "../../common/context/EntityContext";
import { SourceCodeVersionContent } from "../components/SourceCodeVersionContent";
import { TemplateVersionReorderDialog } from "../components/TemplateVersionReorderDialog";
import { GqlSourceCodeVersion, SCV_DETAIL_FIELDS } from "../graphql";

export const SourceCodeVersionPage = () => {
  const { source_code_version_id } = useParams();

  return (
    <EntityProvider
      entity_name="sourceCodeVersion"
      entity_id={source_code_version_id || ""}
      entityFields={SCV_DETAIL_FIELDS}
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
                startIcon={<ReorderIcon />}
                onClick={() => setDialogOpen(true)}
              >
                Rearrange Versions
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
