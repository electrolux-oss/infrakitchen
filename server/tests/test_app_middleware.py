import json

import pytest
from fastapi.responses import HTMLResponse, Response
from fastapi.testclient import TestClient

import app as app_module

# Under /api/graphql so the secret-masking middleware applies
MASK_TEST_PATH = "/api/graphql-middleware-test"
HTML_TEST_PATH = "/api/graphql-middleware-test-html"


@pytest.fixture
def client():
    async def _json_with_charset():
        body = {"data": {"secret": "EncryptedSecretStr:abc", "name": "visible"}}
        return Response(json.dumps(body), media_type="application/json; charset=utf-8")

    async def _html():
        return HTMLResponse("<html></html>")

    app = app_module.app
    app.add_api_route(MASK_TEST_PATH, _json_with_charset)
    app.add_api_route(HTML_TEST_PATH, _html)
    try:
        # Not entered as a context manager, so the lifespan (DB, JWT key check) does not run
        yield TestClient(app)
    finally:
        app.router.routes[:] = [
            route for route in app.router.routes if getattr(route, "path", None) not in (MASK_TEST_PATH, HTML_TEST_PATH)
        ]


def test_security_headers_are_set(client):
    response = client.get("/zstatus")

    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Content-Security-Policy"] == "default-src 'none'; frame-ancestors 'none'"


def test_html_responses_skip_csp(client):
    # GraphiQL is HTML that loads scripts from a CDN
    response = client.get(HTML_TEST_PATH)

    assert "Content-Security-Policy" not in response.headers
    assert response.headers["X-Frame-Options"] == "DENY"


def test_hsts_follows_https_infrakitchen_url(client, monkeypatch):
    monkeypatch.setattr(app_module, "_HSTS_ENABLED", False)
    assert "Strict-Transport-Security" not in client.get("/zstatus").headers

    monkeypatch.setattr(app_module, "_HSTS_ENABLED", True)
    assert client.get("/zstatus").headers["Strict-Transport-Security"] == "max-age=31536000; includeSubDomains"


def test_secrets_are_masked_when_content_type_has_charset(client):
    response = client.get(MASK_TEST_PATH)

    assert response.json() == {"data": {"secret": "********", "name": "visible"}}


def test_no_cors_headers_without_configured_origins(client):
    response = client.get("/zstatus", headers={"Origin": "https://evil.example"})

    assert "access-control-allow-origin" not in response.headers
