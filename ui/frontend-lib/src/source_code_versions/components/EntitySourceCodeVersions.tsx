import { useRef, useState } from "react";

import ReorderIcon from "@mui/icons-material/Reorder";
import { Button } from "@mui/material";

import { PermissionWrapper } from "../../common";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../common/components/entity_table/EntityFetchTable";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { useEntityProvider } from "../../common/context/EntityContext";
import { SCV_FIELD_MAP } from "../graphql/fragments";

import { sourceCodeVersionColumns } from "./sourceCodeVersionTableConfig";
import { TemplateVersionReorderDialog } from "./TemplateVersionReorderDialog";

interface EntitySourceCodeVersionsProps {
  fixedFilters: Record<string, any>;
  filterStorageKey: string;
}

export const EntitySourceCodeVersions = ({
  fixedFilters,
  filterStorageKey,
}: EntitySourceCodeVersionsProps) => {
  const { entity } = useEntityProvider();
  const tableRef = useRef<EntityFetchTableRef>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <PermissionWrapper
        requiredPermission="api:source_code_version"
        permissionAction="write"
      >
        <Button
          variant="outlined"
          startIcon={<ReorderIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{ mb: 2 }}
        >
          Rearrange Versions
        </Button>
      </PermissionWrapper>
      <EntityFetchTable
        ref={tableRef}
        title="Template Versions"
        entityName="sourceCodeVersion"
        columns={sourceCodeVersionColumns}
        entityFieldMap={SCV_FIELD_MAP}
        filterStorageKey={filterStorageKey}
        buildApiFilters={(filterValues) => ({
          ...buildAdvancedApiFilters(filterValues),
          ...fixedFilters,
        })}
      />
      {entity?.id ? (
        <TemplateVersionReorderDialog
          open={dialogOpen}
          templateId={entity.id}
          templateName={entity.name}
          onClose={() => setDialogOpen(false)}
          onSaved={() => tableRef.current?.refresh()}
        />
      ) : null}
    </>
  );
};
