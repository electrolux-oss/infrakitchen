from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from graphql_api.schema import schema

SCHEDULERS_QUERY = """
    query Schedulers {
        schedulers {
            id
            type
            script
            cron
        }
    }
"""

CREATE_SCHEDULER_MUTATION = """
    mutation CreateScheduler($input: SchedulerJobCreateInput!) {
        createScheduler(input: $input) {
            id
            type
            script
            cron
        }
    }
"""

UPDATE_SCHEDULER_MUTATION = """
    mutation UpdateScheduler($id: UUID!, $input: SchedulerJobUpdateInput!) {
        updateScheduler(id: $id, input: $input) {
            id
            type
            script
            cron
        }
    }
"""

DELETE_SCHEDULER_MUTATION = """
    mutation DeleteScheduler($id: UUID!) {
        deleteScheduler(id: $id)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestSchedulerGraphql:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.scheduler.queries.get_scheduler_job_service")
    async def test_schedulers_returns_jobs(self, mock_get_service, mocked_user):
        service = Mock()
        service.get_all = AsyncMock(
            return_value=[
                Mock(
                    model_dump=lambda: {
                        "id": uuid4(),
                        "type": "SQL",
                        "script": "SELECT 1",
                        "cron": "0 * * * *",
                        "created_at": None,
                    }
                )
            ]
        )
        mock_get_service.return_value = service

        result = await schema.execute(SCHEDULERS_QUERY, context_value=make_context(mocked_user))

        assert result.errors is None
        assert result.data is not None
        assert len(result.data["schedulers"]) == 1
        assert result.data["schedulers"][0]["type"] == "SQL"

    @pytest.mark.asyncio
    @patch("graphql_api.helpers.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.scheduler.mutations.get_scheduler_job_service")
    async def test_create_scheduler_returns_job(self, mock_get_service, mock_is_super_admin, mocked_user):
        mock_is_super_admin.return_value = True
        job_id = uuid4()
        service = Mock()
        service.create = AsyncMock(
            return_value=Mock(
                model_dump=lambda: {
                    "id": job_id,
                    "type": "SQL",
                    "script": "SELECT 1",
                    "cron": "0 * * * *",
                    "created_at": None,
                }
            )
        )
        mock_get_service.return_value = service

        result = await schema.execute(
            CREATE_SCHEDULER_MUTATION,
            variable_values={"input": {"type": "SQL", "script": "SELECT 1", "cron": "0 * * * *"}},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "createScheduler": {
                "id": str(job_id),
                "type": "SQL",
                "script": "SELECT 1",
                "cron": "0 * * * *",
            }
        }

    @pytest.mark.asyncio
    @patch("graphql_api.helpers.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.scheduler.mutations.get_scheduler_job_service")
    async def test_update_scheduler_returns_job(self, mock_get_service, mock_is_super_admin, mocked_user):
        mock_is_super_admin.return_value = True
        job_id = uuid4()
        service = Mock()
        service.update = AsyncMock(
            return_value=Mock(
                model_dump=lambda: {
                    "id": job_id,
                    "type": "BASH",
                    "script": "echo hi",
                    "cron": "*/5 * * * *",
                    "created_at": None,
                }
            )
        )
        mock_get_service.return_value = service

        result = await schema.execute(
            UPDATE_SCHEDULER_MUTATION,
            variable_values={"id": str(job_id), "input": {"type": "BASH", "script": "echo hi", "cron": "*/5 * * * *"}},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "updateScheduler": {
                "id": str(job_id),
                "type": "BASH",
                "script": "echo hi",
                "cron": "*/5 * * * *",
            }
        }

    @pytest.mark.asyncio
    @patch("graphql_api.helpers.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.scheduler.mutations.get_scheduler_job_service")
    async def test_delete_scheduler_returns_true(self, mock_get_service, mock_is_super_admin, mocked_user):
        mock_is_super_admin.return_value = True
        job_id = uuid4()
        service = Mock()
        service.delete = AsyncMock(return_value=True)
        mock_get_service.return_value = service

        result = await schema.execute(
            DELETE_SCHEDULER_MUTATION,
            variable_values={"id": str(job_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteScheduler": True}
        service.delete.assert_awaited_once_with(job_id=job_id)
