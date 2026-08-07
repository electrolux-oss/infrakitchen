import strawberry
from strawberry.types import Info
from application.use_cases.golden_state_report.dependencies import get_golden_state_report_service
from graphql_api.helpers import IsAuthenticated, check_api_permission
from graphql_api.modules.golden_state.types import GoldenStateSummaryType


@strawberry.type
class GoldenStateQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def golden_state_report(self, info: Info) -> GoldenStateSummaryType:
        await check_api_permission(info, "resource", ["read"])
        service = get_golden_state_report_service(info.context["session"])
        summary = await service.get_summary()
        return GoldenStateSummaryType.from_pydantic(summary)
