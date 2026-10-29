import uuid

import strawberry
from strawberry.types import Info

from application.use_cases.drift_report.dependencies import get_drift_report_service
from graphql_api.helpers import IsAuthenticated, check_api_permission
from graphql_api.modules.drift.types import DriftSummaryType


@strawberry.type
class DriftQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def drift_report(self, info: Info, project_id: uuid.UUID | None = None) -> DriftSummaryType:
        await check_api_permission(info, "resource", ["read"])
        service = get_drift_report_service(info.context["session"])
        summary = await service.get_summary(project_id)
        return DriftSummaryType.from_pydantic(summary)
