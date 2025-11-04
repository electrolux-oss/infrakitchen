from uuid import uuid4
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from core.scheduler.api import router
from core.scheduler.dependencies import get_scheduler_job_service

from core.scheduler.schema import SchedulerJobResponse, SchedulerJobCreate, JobType
from http import HTTPStatus

SQL_SCRIPT = "DELETE from logs"
BASH_SCRIPT = "#!/bin/bash echo hi"
CRON = "*/5 * * * *"


@pytest.fixture(autouse=True)
def app():
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def override_service(app):
    def _override(service: MockSchedulerJobService):
        async def _get_service():
            return service

        app.dependency_overrides[get_scheduler_job_service] = _get_service

    return _override


@pytest.fixture
def client_with_user(app):
    class MockUser:
        id = "user123"

    user = MockUser()

    @app.middleware("http")
    async def add_user(request, call_next):
        request.state.user = user
        return await call_next(request)

    return TestClient(app)


@pytest.fixture
def client_without_user(app):
    @app.middleware("http")
    async def add_user(request, call_next):
        request.state.user = None
        return await call_next(request)

    return TestClient(app)


class MockSchedulerJobService:
    def __init__(self, all_jobs=None, created_job=None):
        self._all_jobs = all_jobs or []
        self._created_job = created_job

    async def get_all(self):
        return self._all_jobs

    async def create(self, job: SchedulerJobCreate):
        return self._created_job


class TestGetAll:
    def test_get_all_empty(self, client, override_service):
        service = MockSchedulerJobService(all_jobs=[])
        override_service(service)

        response = client.get("/scheduler/jobs")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []

    def test_get_all_with_jobs(self, client, override_service):
        jobs = [
            SchedulerJobResponse(id=uuid4(), type=JobType.SQL, script=SQL_SCRIPT, cron=CRON),
            SchedulerJobResponse(id=uuid4(), type=JobType.BASH, script=BASH_SCRIPT, cron=CRON),
        ]
        service = MockSchedulerJobService(all_jobs=jobs)
        override_service(service)

        response = client.get("/scheduler/jobs")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert len(json_response) == 2


class TestCreate:
    def test_create_forbidden_when_no_requester(self, client_without_user):
        scheduler_job_create = {"type": "SQL", "script": SQL_SCRIPT, "cron": CRON}

        response = client_without_user.post("/scheduler/jobs", json=scheduler_job_create)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_create_forbidden_when_user_is_not_super_admin(self, client_without_user, monkeypatch):
        scheduler_job_create = {"type": "SQL", "script": SQL_SCRIPT, "cron": CRON}

        async def mock_user_is_super_admin(user_id: str) -> bool:
            return False

        monkeypatch.setattr("core.scheduler.api.user_is_super_admin", mock_user_is_super_admin)

        response = client_without_user.post("/scheduler/jobs", json=scheduler_job_create)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_create_success(self, client_with_user, override_service, monkeypatch):
        scheduler_job_create = {"type": "SQL", "script": SQL_SCRIPT, "cron": CRON}
        scheduler_job_response = SchedulerJobResponse(id=uuid4(), type=JobType.SQL, script=SQL_SCRIPT, cron=CRON)

        service = MockSchedulerJobService(created_job=scheduler_job_response)
        override_service(service)

        async def mock_user_is_super_admin(user_id: str) -> bool:
            return True

        monkeypatch.setattr("core.scheduler.api.user_is_super_admin", mock_user_is_super_admin)

        response = client_with_user.post("/scheduler/jobs", json=scheduler_job_create)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["type"] == JobType.SQL
        assert json_response["script"] == SQL_SCRIPT
        assert json_response["cron"] == CRON
