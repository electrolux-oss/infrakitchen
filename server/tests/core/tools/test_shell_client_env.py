from unittest.mock import Mock

from core.tools.shell_client import ShellScriptClient


def make_client() -> ShellScriptClient:
    return ShellScriptClient(command="tofu", command_args="init", workspace_path="/tmp", logger=Mock())


def test_ca_certificate_variables_are_passed_when_set(monkeypatch):
    monkeypatch.setenv("SSL_CERT_FILE", "/etc/ssl/bundle.crt")
    monkeypatch.setenv("SSL_CERT_DIR", "/etc/ssl/certs")

    env = make_client()._default_env()

    assert env["SSL_CERT_FILE"] == "/etc/ssl/bundle.crt"
    assert env["SSL_CERT_DIR"] == "/etc/ssl/certs"


def test_ca_certificate_variables_are_left_out_when_not_set(monkeypatch):
    monkeypatch.delenv("SSL_CERT_FILE", raising=False)
    monkeypatch.delenv("SSL_CERT_DIR", raising=False)

    env = make_client()._default_env()

    assert "SSL_CERT_FILE" not in env
    assert "SSL_CERT_DIR" not in env
