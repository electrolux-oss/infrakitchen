import pytest

from application.source_codes.repository import (
    commit_web_url,
    repository_web_url,
)


@pytest.mark.parametrize(
    ("repository_url", "expected"),
    [
        ("https://github.com/org/repo.git", "https://github.com/org/repo"),
        ("https://github.com/org/repo", "https://github.com/org/repo"),
        ("git@github.com:org/repo.git", "https://github.com/org/repo"),
        ("ssh://git@gitlab.com/group/sub/repo.git", "https://gitlab.com/group/sub/repo"),
        ("https://user@bitbucket.org/ws/repo.git", "https://bitbucket.org/ws/repo"),
        ("https://org@dev.azure.com/org/proj/_git/repo", "https://dev.azure.com/org/proj/_git/repo"),
        ("git@ssh.dev.azure.com:v3/org/proj/repo", "https://dev.azure.com/org/proj/_git/repo"),
        ("not a url", None),
    ],
)
def test_repository_web_url(repository_url: str, expected: str | None):
    assert repository_web_url(repository_url) == expected


@pytest.mark.parametrize(
    ("repository_url", "expected"),
    [
        ("git@github.com:org/repo.git", "https://github.com/org/repo/commit/abc"),
        ("https://gitlab.com/g/repo.git", "https://gitlab.com/g/repo/-/commit/abc"),
        ("https://bitbucket.org/ws/repo.git", "https://bitbucket.org/ws/repo/commits/abc"),
    ],
)
def test_commit_web_url(repository_url: str, expected: str):
    assert commit_web_url(repository_url, "abc") == expected
