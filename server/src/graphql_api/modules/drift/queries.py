import uuid

import strawberry
from strawberry.types import Info

from application.resource_drifts.dependencies import get_drift_settings_service
from application.use_cases.drift_report.dependencies import get_drift_report_service
from graphql_api.helpers import IsAuthenticated, IsSuperAdmin, check_api_permission
from graphql_api.modules.drift.types import DriftReportType, DriftSettingsType


@strawberry.type
class DriftQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def drift_report(self, info: Info, project_id: uuid.UUID | None = None) -> DriftReportType:
        # counts of every project for anyone who can read resources: intended, they hold no resource details
        await check_api_permission(info, "resource", ["read"])
        report = await get_drift_report_service(info.context["session"]).get_report(project_id)
        return DriftReportType.from_pydantic(report)

    @strawberry.field(permission_classes=[IsSuperAdmin])
    async def drift_settings(self, info: Info) -> DriftSettingsType:
        settings = await get_drift_settings_service(info.context["session"]).get()
        return DriftSettingsType.from_pydantic(settings)
