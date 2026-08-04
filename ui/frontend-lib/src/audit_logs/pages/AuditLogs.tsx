import { EntityFetchTable } from "../../common/components/entity_table/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import { auditLogColumns } from "../components/auditLogTableConfig";
import { AUDIT_LOG_FIELD_MAP } from "../graphql";

export const AuditLogsPage = () => {
  return (
    <PageContainer title="Audit Logs">
      <EntityFetchTable
        title="Audit Log"
        entityName="auditLog"
        columns={auditLogColumns}
        entityFieldMap={AUDIT_LOG_FIELD_MAP}
        syncFiltersToUrl
      />
    </PageContainer>
  );
};

AuditLogsPage.path = "/audit_logs";
