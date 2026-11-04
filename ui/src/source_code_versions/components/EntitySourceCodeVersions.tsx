import { useRef, useState } from "react";

import { useNavigate } from "react-router";

import { CreatePrefillState, useHasPermission } from "../../common";
import {
  EntityFetchTable,
  EntityFetchTableRef,
} from "../../common/components/entity_table/EntityFetchTable";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import { HeroAdjustmentsHorizontalIcon, HeroPlusCircleIcon } from "../../icons";
import { Button } from "../../ui";
import { SCV_FIELD_MAP } from "../graphql/fragments";

import {
  sourceCodeVersionColumns,
  sourceCodeVersionDefaultColumnVisibilityModel,
} from "./sourceCodeVersionTableConfig";
import { TemplateVersionReorderDialog } from "./TemplateVersionReorderDialog";

interface EntitySourceCodeVersionsProps {
  fixedFilters: Record<string, any>;
  filterStorageKey: string;
}

/**
 * Versions table for the template in the surrounding entity context: the
 * create shortcut and the reorder dialog both act on that template.
 */
export const EntitySourceCodeVersions = ({
  fixedFilters,
  filterStorageKey,
}: EntitySourceCodeVersionsProps) => {
  const { entity } = useEntityProvider();
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();
  const tableRef = useRef<EntityFetchTableRef>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const canManageVersions = useHasPermission(
    "api:source_code_version",
    "write",
  );

  return (
    <>
      <EntityFetchTable
        ref={tableRef}
        title="Template Versions"
        entityName="sourceCodeVersion"
        columns={sourceCodeVersionColumns}
        defaultColumnVisibilityModel={
          sourceCodeVersionDefaultColumnVisibilityModel
        }
        entityFieldMap={SCV_FIELD_MAP}
        filterStorageKey={filterStorageKey}
        toolbarActions={
          canManageVersions ? (
            <>
              <Button
                variant="contained"
                startIcon={<HeroPlusCircleIcon />}
                disabled={!entity?.id}
                onClick={() =>
                  navigate(`${linkPrefix}source_code_versions/create`, {
                    state: {
                      template_id: entity?.id,
                    } satisfies CreatePrefillState,
                  })
                }
              >
                Create New Version
              </Button>
              <Button
                startIcon={<HeroAdjustmentsHorizontalIcon />}
                onClick={() => setDialogOpen(true)}
              >
                Manage Versions
              </Button>
            </>
          ) : undefined
        }
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
