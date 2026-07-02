from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.source_code_versions.schema import (
    BatchTemplatePortsResponse,
    SourceConfigTemplateReferenceResponse,
    SourceOutputConfigTemplateResponse,
    TemplatePortsItem,
)
from application.templates.schema import TemplateShort
from graphql_api.schema import schema

SOURCE_CODE_VERSION_TEMPLATE_CONFIGS_QUERY = """
    query SourceCodeVersionTemplateConfigs($templateId: UUID!) {
        sourceCodeVersionTemplateConfigs(templateId: $templateId) {
            id
            name
            type
        }
    }
"""

TEMPLATE_PORTS_QUERY = """
    query TemplatePorts($templateIds: [UUID!]!) {
        templatePorts(templateIds: $templateIds) {
            template {
                id
                name
                abstract
                parents {
                    id
                    name
                    abstract
                }
            }
            configs {
                name
            }
            outputs {
                name
            }
            references {
                referenceTemplateId
                templateId
                inputConfigName
                outputConfigName
            }
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestSourceCodeVersionQueries:
    @pytest.mark.asyncio
    async def test_source_code_version_template_configs_returns_configs(
        self,
        mocked_source_config,
        mocked_user,
    ):
        session = Mock()
        execute_result = Mock()
        execute_result.unique.return_value.scalars.return_value.all.return_value = [mocked_source_config]
        session.execute = AsyncMock(return_value=execute_result)

        result = await schema.execute(
            SOURCE_CODE_VERSION_TEMPLATE_CONFIGS_QUERY,
            variable_values={"templateId": str(uuid4())},
            context_value={**make_context(mocked_user), "session": session},
        )

        assert result.errors is None
        assert result.data == {
            "sourceCodeVersionTemplateConfigs": [
                {
                    "id": str(mocked_source_config.id),
                    "name": mocked_source_config.name,
                    "type": mocked_source_config.type,
                }
            ]
        }
        session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code_version.queries.get_source_code_version_service")
    async def test_template_ports_returns_ports(
        self,
        mock_get_service,
        template_response,
        mocked_source_config_response,
        mocked_user,
    ):
        parent_id = uuid4()
        template_response.abstract = False
        template_response.parents = [
            TemplateShort(
                id=parent_id,
                name="Parent Template",
                abstract=True,
                cloud_resource_types=[],
            )
        ]
        batch_response = BatchTemplatePortsResponse(
            templates=[
                TemplatePortsItem(
                    template=template_response,
                    configs=[mocked_source_config_response],
                    outputs=[
                        SourceOutputConfigTemplateResponse(
                            name="output_one",
                            description="Output One",
                        )
                    ],
                    references=[
                        SourceConfigTemplateReferenceResponse(
                            id=uuid4(),
                            template_id=template_response.id,
                            reference_template_id=parent_id,
                            input_config_name="input_one",
                            output_config_name="output_one",
                        )
                    ],
                )
            ]
        )
        mock_service = Mock()
        mock_service.get_batch_template_ports = AsyncMock(return_value=batch_response)
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            TEMPLATE_PORTS_QUERY,
            variable_values={"templateIds": [str(template_response.id)]},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "templatePorts": [
                {
                    "template": {
                        "id": str(template_response.id),
                        "name": template_response.name,
                        "abstract": False,
                        "parents": [
                            {
                                "id": str(parent_id),
                                "name": "Parent Template",
                                "abstract": True,
                            }
                        ],
                    },
                    "configs": [{"name": mocked_source_config_response.name}],
                    "outputs": [{"name": "output_one"}],
                    "references": [
                        {
                            "referenceTemplateId": str(parent_id),
                            "templateId": str(template_response.id),
                            "inputConfigName": "input_one",
                            "outputConfigName": "output_one",
                        }
                    ],
                }
            ]
        }
        mock_service.get_batch_template_ports.assert_awaited_once_with(template_ids=[template_response.id])
