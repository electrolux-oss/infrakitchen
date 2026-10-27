import { useRef, useState } from "react";

import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import { buildAdvancedApiFilters } from "../../common/components/filter_panel/buildAdvancedApiFilters";
import PageContainer from "../../common/PageContainer";
import { HeroClipboardDocumentListIcon } from "../../icons";
import { auditLogColumns } from "../components/auditLogTableConfig";
import { EntityTypeQuickFilters } from "../components/EntityTypeQuickFilters";
import { AUDIT_LOG_FIELD_MAP } from "../graphql";

export const AuditLogsPage = () => {
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([]);
  const selectedEntityTypesRef = useRef(selectedEntityTypes);
  selectedEntityTypesRef.current = selectedEntityTypes;

  return (
    <PageContainer
      title="Audit Logs"
      icon={<HeroClipboardDocumentListIcon />}
      description="Records of activities across the system, most recent first."
    >
      <EntityFetchTable
        title="Audit Log"
        entityName="auditLog"
        columns={auditLogColumns}
        rowClickable={false}
        entityFieldMap={AUDIT_LOG_FIELD_MAP}
        defaultSort={{ field: "created_at", sort: "desc" }}
        quickFilters={
          <EntityTypeQuickFilters
            selected={selectedEntityTypes}
            onChange={setSelectedEntityTypes}
          />
        }
        buildApiFilters={(filterValues) => {
          const apiFilters = buildAdvancedApiFilters(filterValues);
          if (selectedEntityTypesRef.current.length > 0) {
            apiFilters.model__in = selectedEntityTypesRef.current;
          }
          return apiFilters;
        }}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

AuditLogsPage.path = "/audit_logs";
