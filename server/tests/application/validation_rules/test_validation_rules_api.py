from http import HTTPStatus
from typing import Any
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from application.validation_rules.api import router
from application.validation_rules.dependencies import get_validation_rule_service
from application.validation_rules.model import ValidationRuleTargetType
from application.validation_rules.schema import (
    ValidationRuleResponse,
    ValidationRuleTemplateReference,
    ValidationRulesByVariableResponse,
)

TEMPLATE_ID = "template-id"


class MockValidationRuleService:
    def __init__(self, template_rules=None, variable_rules=None, reference=None, replaced=None):
        self.template_rules = template_rules or []
        self.variable_rules = variable_rules or []
        self.reference = reference
        self.replaced = replaced or []
        self.calls: list[tuple[Any, ...]] = []

    async def get_rules_for_template(self, template_id: str):
        self.calls.append(("template", template_id))
        return self.template_rules

    async def get_rules_for_variable(self, template_id: str, variable_name: str):
        self.calls.append(("variable", template_id, variable_name))
        return self.variable_rules

    async def add_rule_for_template(self, template_id: str, variable_name: str, rule: dict[str, Any], requester):
        self.calls.append(("add", template_id, variable_name, rule, requester))
        return self.reference

    async def replace_rules_for_variable(
        self, template_id: str, variable_name: str, rules: list[dict[str, Any]], requester
    ):
        self.calls.append(("replace", template_id, variable_name, tuple(rules), requester))
        return self.replaced

    async def delete_rule_reference(self, template_id: str, variable_name: str, reference_id: str):
        self.calls.append(("delete", template_id, variable_name, reference_id))


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
    def _override(service: MockValidationRuleService):
        async def _get_service():
            return service

        app.dependency_overrides[get_validation_rule_service] = _get_service

    return _override


@pytest.fixture
def client_with_user(app):
    class MockUser:
        id = "user-1"

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


@pytest.fixture
def validation_rule_response():
    return ValidationRuleResponse(
        id=uuid4(),
        target_type=ValidationRuleTargetType.STRING,
        description="must be string",
    )


@pytest.fixture
def validation_rule_reference():
    return ValidationRuleTemplateReference(
        id=uuid4(),
        template_id=uuid4(),
        variable_name="cpu",
        validation_rule_id=uuid4(),
    )


class TestGetTemplateRules:
    def test_returns_rules(self, client, override_service, validation_rule_response):
        grouped = ValidationRulesByVariableResponse(variable_name="cpu", rules=[validation_rule_response])
        service = MockValidationRuleService(template_rules=[grouped])
        override_service(service)

        response = client.get(f"/validation_rules/template/{TEMPLATE_ID}")

        assert response.status_code == HTTPStatus.OK
        payload = response.json()[0]
        assert payload["variable_name"] == "cpu"
        assert payload["rules"][0]["id"] == str(validation_rule_response.id)

    def test_filters_by_variable(self, client, override_service, validation_rule_response):
        service = MockValidationRuleService(variable_rules=[validation_rule_response])
        override_service(service)

        response = client.get(f"/validation_rules/template/{TEMPLATE_ID}?variable_name=cpu")

        assert response.status_code == HTTPStatus.OK
        payload = response.json()[0]
        assert payload["variable_name"] == "cpu"
        assert payload["rules"][0]["id"] == str(validation_rule_response.id)


class TestCreateTemplateRule:
    def test_requires_user(self, client_without_user):
        template_id = str(uuid4())
        body = {
            "template_id": template_id,
            "variable_name": "cpu",
            "rule": {"target_type": "string", "regex_pattern": "^foo$"},
        }

        response = client_without_user.post(f"/validation_rules/template/{template_id}", json=body)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_validates_template_id(self, client_with_user, override_service):
        service = MockValidationRuleService(reference=None)
        override_service(service)

        path_template_id = str(uuid4())
        body = {
            "template_id": str(uuid4()),
            "variable_name": "cpu",
            "rule": {"target_type": "string", "regex_pattern": "^foo$"},
        }

        response = client_with_user.post(f"/validation_rules/template/{path_template_id}", json=body)

        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Template id mismatch"}

    def test_creates_reference(self, client_with_user, override_service, validation_rule_reference):
        template_id = str(validation_rule_reference.template_id)
        service = MockValidationRuleService(reference=validation_rule_reference)
        override_service(service)

        body = {
            "template_id": template_id,
            "variable_name": validation_rule_reference.variable_name,
            "rule": {"target_type": "string", "regex_pattern": "^foo$"},
        }

        response = client_with_user.post(f"/validation_rules/template/{template_id}", json=body)

        assert response.status_code == HTTPStatus.CREATED
        assert response.json()["variable_name"] == validation_rule_reference.variable_name


class TestReplaceTemplateRules:
    def test_requires_user(self, client_without_user):
        template_id = str(uuid4())
        response = client_without_user.put(
            f"/validation_rules/template/{template_id}/cpu",
            json={"rules": [{"target_type": "string", "regex_pattern": "^foo$"}]},
        )
        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_replaces_rules(self, client_with_user, override_service, validation_rule_reference):
        service = MockValidationRuleService(replaced=[validation_rule_reference])
        override_service(service)
        template_id = str(validation_rule_reference.template_id)
        body = {"rules": [{"target_type": "string", "regex_pattern": "^foo$"}]}

        response = client_with_user.put(
            f"/validation_rules/template/{template_id}/{validation_rule_reference.variable_name}",
            json=body,
        )

        assert response.status_code == HTTPStatus.OK
        assert response.json()[0]["validation_rule_id"] == str(validation_rule_reference.validation_rule_id)


class TestDeleteTemplateRule:
    def test_requires_user(self, client_without_user):
        response = client_without_user.delete(
            f"/validation_rules/template/{uuid4()}/cpu/{uuid4()}",
        )
        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_deletes_reference(self, client_with_user, override_service, validation_rule_reference):
        service = MockValidationRuleService()
        override_service(service)
        template_id = str(validation_rule_reference.template_id)

        response = client_with_user.delete(
            f"/validation_rules/template/{template_id}/{validation_rule_reference.variable_name}/{validation_rule_reference.id}",
        )

        assert response.status_code == HTTPStatus.NO_CONTENT
