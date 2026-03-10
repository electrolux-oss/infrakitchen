from uuid import uuid4

import pytest
from pydantic import ValidationError

from application.resources.schema import ResourceCreate

_TEMPLATE_ID = uuid4()


def _create(**kwargs) -> ResourceCreate:
    return ResourceCreate(template_id=_TEMPLATE_ID, **kwargs)


class TestResourceCreateName:
    # valid plain strings

    @pytest.mark.parametrize(
        "name",
        [
            "my-resource",
            "name_123",
            "simple",
            "UPPERCASE",
            "mixed-Case_123",
            "a",
        ],
    )
    def test_valid_plain_name(self, name):
        r = _create(name=name)
        assert r.name == name

    # valid pattern strings
    # Note: the placeholder identifier regex allows letters, digits, hyphens,
    # and underscores (e.g. {service-name} and {1_env} are accepted).

    @pytest.mark.parametrize(
        "name",
        [
            "{region}",
            "{region}-{namespace}-{service_name}",
            "prefix-{env}",
            "{env}-suffix",
            "a-{b}-c-{d}",
            "{region_1}-{ns2}",
            "{service-name}",  # hyphen inside placeholder is allowed
            "{1env}",  # leading digit inside placeholder is allowed
            "{bad-placeholder}",  # hyphen-separated words are allowed
        ],
    )
    def test_valid_pattern_name(self, name):
        r = _create(name=name)
        assert r.name == name

    # invalid: malformed patterns

    @pytest.mark.parametrize(
        "name,match",
        [
            ("{region", "mismatched braces"),
            ("region}", "mismatched braces"),
            ("{}", "valid identifiers"),  # empty placeholder
            ("{bad placeholder}", "valid identifiers"),  # space not allowed
        ],
    )
    def test_invalid_pattern_name(self, name, match):
        with pytest.raises(ValidationError, match=match):
            _create(name=name)


class TestResourceCreateStoragePath:
    # valid plain paths

    @pytest.mark.parametrize(
        "path",
        [
            "path/to/storage",
            "some_path",
            "path-with-dashes",
            None,
        ],
    )
    def test_valid_plain_storage_path(self, path):
        r = _create(name="my-resource", storage_path=path)
        assert r.storage_path == path

    # valid pattern paths

    @pytest.mark.parametrize(
        "path",
        [
            "{region}/bucket",
            "base/{env}/{service}",
            "{team}-{project}/data",
            "{1env}/data",  # leading digit in placeholder is allowed
            "{service-name}/data",  # hyphen in placeholder is allowed
        ],
    )
    def test_valid_pattern_storage_path(self, path):
        r = _create(name="my-resource", storage_path=path)
        assert r.storage_path == path

    # invalid: malformed patterns

    @pytest.mark.parametrize(
        "path,match",
        [
            ("{region/bucket", "mismatched braces"),
            ("{}", "valid identifiers"),  # empty placeholder
            ("{bad path}/bucket", "valid identifiers"),  # space not allowed
        ],
    )
    def test_invalid_pattern_storage_path(self, path, match):
        with pytest.raises(ValidationError, match=match):
            _create(name="my-resource", storage_path=path)
