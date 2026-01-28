import asyncio
from contextlib import asynccontextmanager
import datetime
import random
from typing import Any, Literal, TypedDict, cast

from lorem import get_sentence, get_word
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.dependencies import get_integration_service
from application.resources.dependencies import get_resource_service
from application.resources.model import Resource
from application.resources.schema import Outputs, ResourceCreate
from application.resources.crud import ResourceCRUD
from application.source_code_versions.dependencies import get_source_code_version_service
from application.source_code_versions.schema import (
    SourceCodeVersionCreate,
    SourceCodeVersionResponse,
    SourceCodeVersionVariablesCreate,
    SourceConfigCreate,
    SourceOutputConfigCreate,
)
from application.source_codes.dependencies import get_source_code_service
from application.source_codes.schema import SourceCodeCreate
from application.storages.dependencies import get_storage_service
from application.templates.dependencies import get_template_service
from application.validation_rules.model import ValidationRule
from application.validation_rules.types import ValidationRuleDataType
from core.auth_providers.dependencies import get_auth_provider_service
from core.auth_providers.schema import AuthProviderCreate, GuestProviderConfig
from core.config import setup_service_environment
from core.users.dependencies import get_user_service
from core.users.schema import UserCreateWithProvider
from core.models.encrypted_secret import EncryptedSecretStr
from core.audit_logs.handler import AuditLogHandler
from application.templates.schema import TemplateCreate
from core.rabbitmq import RabbitMQConnection

from core.base_models import Base, MessageModel
from application.source_code_versions.model import SourceCodeVersion
from application.source_codes.model import SourceCode
from core.custom_entity_log_controller import EntityLogger
from core.constants import ModelState, ModelStatus
from core.database import SessionLocal, engine
from core.users.model import UserDTO

from application.storages.schema import StorageCreate
from application.integrations.schema import IntegrationCreate
from application import (
    DependencyConfig,
    DependencyTag,
    OutputVariableModel,
    VariableModel,
    Variables,
)
from application.integrations.model import Integration
from application.integrations.schema import (
    AWSIntegrationConfig,
    AzureRMIntegrationConfig,
    BitbucketIntegrationConfig,
    GithubIntegrationConfig,
)
from application.storages.schema import AWSStorageConfig, AzureRMStorageConfig
from application.storages.model import Storage


class ValidationRuleUpdates(TypedDict, total=False):
    regex: str
    no_whitespace: bool
    max_length: int
    min_value: float
    max_value: float
    rule_metadata: dict[str, Any]


class ValidationRuleSpec(TypedDict):
    entity_name: str
    field_path: str
    data_type: ValidationRuleDataType
    updates: ValidationRuleUpdates


async def send_message(message: MessageModel, confirm: bool = False):
    pass


# Monkey patching the send_task method
RabbitMQConnection.send_message = send_message  # type: ignore[method-assign]


async def drop_all_tables(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def get_session():
    async with SessionLocal() as session:
        yield session


async def change_state(
    session: AsyncSession, entity: type[Base], state: ModelState | None = None, status: ModelStatus | None = None
):
    if state is None and status is None:
        return
    if state is None:
        statement = update(entity).values(status=status)
    elif status is None:
        statement = update(entity).values(state=state)
    else:
        statement = update(entity).values(state=state, status=status)

    await session.execute(statement)
    await session.commit()


def generate_resource_name(max_length: int = 256) -> str:
    candidate = "_".join(get_word(count=3).split())
    if not candidate:
        candidate = f"resource_{random.randint(1000, 9999)}"
    return candidate[:max_length]


def apply_validation_rule_updates(instance: ValidationRule, updates: ValidationRuleUpdates) -> None:
    if "regex" in updates:
        instance.regex = updates["regex"]
    if "no_whitespace" in updates:
        instance.no_whitespace = updates["no_whitespace"]
    if "max_length" in updates:
        instance.max_length = updates["max_length"]
    if "min_value" in updates:
        instance.min_value = updates["min_value"]
    if "max_value" in updates:
        instance.max_value = updates["max_value"]

    metadata_updates = updates.get("rule_metadata")
    if metadata_updates:
        existing_metadata = dict(instance.rule_metadata or {})
        existing_metadata.update(metadata_updates)
        instance.rule_metadata = existing_metadata


async def create_auth_provider(session: AsyncSession, user: UserDTO):
    auth_provider_service = get_auth_provider_service(session=session)

    providers = await auth_provider_service.count()
    if not providers:
        auth_provider = AuthProviderCreate(
            auth_provider="guest",
            name="Guest",
            enabled=True,
            filter_by_domain=["example.com"],
            configuration=GuestProviderConfig(
                auth_provider="guest",
            ),
            description="Guest provider enabled by default to configure the system. Disable it after configuring the system.",  # noqa
        )
        _ = await auth_provider_service.create(auth_provider, user)
        await session.commit()


async def create_user(session: AsyncSession):
    user_service = get_user_service(session=session)

    user = UserCreateWithProvider(
        email="guest_super@test.com",
        identifier="guest_super",
        first_name="Guest",
        last_name="User",
        display_name="Guest User (super)",
        provider="guest",
        deactivated=False,
        description="Guest user for testing",
    )

    instance = await user_service.create_user_if_not_exists(user)

    return instance


async def insert_template(session: AsyncSession, user: UserDTO):
    template_service = get_template_service(session=session)
    # create templates
    list_templates_to_create = [
        "Account",
        "Environment",
        "Network",
        "Kubernetes",
        "K8s_Namespace",
    ]

    previous_template = None
    current_template = None

    for template_name in list_templates_to_create:
        template = TemplateCreate(
            name=template_name,
            description=get_sentence(),
            template=f"{template_name}_cloud",
            labels=["template", template_name.lower(), "cloud"],
        )

        existant_template = await template_service.get_all(filter={"name": template_name})
        if existant_template:
            previous_template = existant_template[0]
            continue

        if not previous_template:
            current_template = await template_service.create(template, user)
            await session.commit()
            previous_template = current_template
        else:
            assert previous_template.id is not None
            template.parents = [previous_template.id]
            current_template = await template_service.create(template, user)
            await session.commit()
            previous_template = current_template


async def insert_validation_rules(session: AsyncSession):
    rule_specs: list[ValidationRuleSpec] = [
        {
            "entity_name": "resource",
            "field_path": "variables.cluster_name",
            "data_type": ValidationRuleDataType.STRING,
            "updates": {
                "max_length": 128,
                "rule_metadata": {
                    "field": "cluster_name",
                    "max_length": "Cluster name must be 128 characters or fewer.",
                },
            },
        }
    ]

    for spec in rule_specs:
        stmt = select(ValidationRule).where(
            ValidationRule.entity_name == spec["entity_name"],
            ValidationRule.field_path == spec["field_path"],
        )
        result = await session.execute(stmt)
        instance = result.scalars().first()

        if instance is None:
            instance = ValidationRule(
                entity_name=spec["entity_name"],
                field_path=spec["field_path"],
                data_type=spec["data_type"],
            )
            session.add(instance)

        instance.data_type = spec["data_type"]
        apply_validation_rule_updates(instance, spec["updates"])

    await session.commit()


async def insert_source_code_and_version(session: AsyncSession, user: UserDTO):
    template_service = get_template_service(session=session)
    integration_service = get_integration_service(session=session)
    source_code_service = get_source_code_service(session=session)
    source_code_version_service = get_source_code_version_service(session=session)

    integrations = await integration_service.get_all(filter={"integration_type": "git"})
    source_code_list = await source_code_service.get_all()

    source_code_urls = [
        "https://github.com/electrolux-oss/networking",
        "https://github.com/electrolux-oss/k8s",
        "https://github.com/electrolux-oss/k8s_namespace",
    ]

    for source in source_code_urls:
        if source in [src.source_code_url for src in source_code_list]:
            continue

        src = SourceCodeCreate(
            description=get_sentence(),
            source_code_url=source,
            source_code_language="opentofu",
            source_code_provider="github",
            integration_id=random.choice(integrations).id,
            labels=["source_code", "github", "opentofu", "aws"],
        )

        sc_result = await source_code_service.create(src, user)
        await session.commit()
        await generate_logs(
            session=session, entity_name="source_code", entity_id=str(sc_result.id), user_id=str(user.id)
        )
        # Add git tags and branches that can be added only through automation
        statement = update(SourceCode).values(
            git_tags=["v1.0.0", "v1.1.0", "v2.0.0"],
            git_branches=["main", "dev", "staging"],
            git_folders_map=[
                {"ref": "v1.0.0", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
                {"ref": "v1.1.0", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
                {"ref": "v2.0.0", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
                {"ref": "main", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
                {"ref": "dev", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
                {"ref": "staging", "folders": ["code/network", "code/k8s", "code/k8s_namespace"]},
            ],
        )
        await session.execute(statement)
        await session.commit()

    await change_state(
        session=session,
        entity=SourceCode,
        status=ModelStatus.DONE,
    )
    # insert version
    source_code_list = await source_code_service.get_all()
    source_code_version_list = await source_code_version_service.get_all()

    templates = await template_service.get_all()

    for template in templates:
        if template.id in [version.template.id for version in source_code_version_list]:
            continue

        version = SourceCodeVersionCreate(
            template_id=template.id,
            source_code_id=random.choice(source_code_list).id,
            source_code_version="1.0.0",
            source_code_folder=f"test/{template.template}",
            description=get_sentence(),
        )
        current_code_version = await source_code_version_service.create(version, user)
        await session.commit()
        await change_state(
            session=session,
            entity=SourceCodeVersion,
            status=ModelStatus.DONE,
        )
        await generate_logs(
            session=session,
            entity_name="source_code_version",
            entity_id=str(current_code_version.id),
            user_id=str(user.id),
        )
        scv_with_variables = SourceCodeVersionVariablesCreate(
            source_code_version_id=str(current_code_version.id),
            template_id=template.id,
            source_code_id=current_code_version.source_code.id,
            source_code_version=current_code_version.source_code_version,
            variables=[
                VariableModel(
                    **{
                        "name": f"{template.template}_test_var",
                        "description": "Test variable",
                        "type": "array[string]",
                        "default": ["test"],
                    }
                ),
                VariableModel(
                    **{
                        "name": f"{template.template}_test_var_2",
                        "description": "Test variable 2",
                        "type": "boolean",
                        "default": False,
                    }
                ),
                VariableModel(
                    **{"name": f"{template.template}_test_var_3", "description": "Test variable 3", "type": "string"}
                ),
                VariableModel(
                    **{
                        "name": f"{template.template}_test_var_object",
                        "description": "Test variable object",
                        "type": "object",
                    }
                ),
                VariableModel(
                    **{
                        "name": f"{template.template}_test_var_number",
                        "description": "Test variable number",
                        "type": "number",
                        "default": 10,
                    }
                ),
                VariableModel(
                    **{"name": f"{template.template}_test_var_4", "description": "Test variable 4", "type": "string"}
                ),
                VariableModel(
                    **{"name": f"{template.template}_test_var_5", "description": "Test variable 5", "type": "string"}
                ),
            ],
            outputs=[
                OutputVariableModel(
                    **{
                        "name": f"{template.template}_test_output",
                        "description": "Test output",
                        "value": "${try(aws_default_vpc.this[0].arn, None)}",
                    }
                ),
                OutputVariableModel(
                    **{
                        "name": f"{template.template}_test_output_2",
                        "description": "Test output 2",
                        "value": "some_value",
                    }
                ),
                OutputVariableModel(
                    **{
                        "name": f"{template.template}_test_output_3",
                        "description": "Test output 3",
                        "value": "some_value_2",
                    }
                ),
                OutputVariableModel(
                    **{
                        "name": f"{template.template}_test_output_4",
                        "description": "Test output 3",
                        "value": "some_value_2",
                    }
                ),
            ],
        )
        updated = await source_code_version_service.update_variables(
            scv_with_variables,
            user,
        )
        await session.commit()
        await create_scv_config(session, updated)

    await change_state(
        session=session,
        entity=SourceCodeVersion,
        status=ModelStatus.DONE,
    )


async def create_scv_config(session: AsyncSession, scv: SourceCodeVersionResponse):
    source_code_version_service = get_source_code_version_service(session=session)

    configs: list[SourceConfigCreate] = []
    for idx, v in enumerate(scv.variables):
        configs.append(
            SourceConfigCreate(
                index=idx,
                source_code_version_id=scv.id,
                name=v.name,
                description=v.description,
                type=v.type,
                required=True,
                default=v.default,
                frozen=False,
                unique=False,
                options=[],
            )
        )
    _ = await source_code_version_service.create_configs(configs)
    await session.commit()
    outputs: list[SourceOutputConfigCreate] = []
    for idx, o in enumerate(scv.outputs):
        outputs.append(
            SourceOutputConfigCreate(
                index=idx,
                source_code_version_id=scv.id,
                name=o.name,
                description=o.description,
            )
        )
    _ = await source_code_version_service.create_output_configs(outputs)
    await session.commit()


async def insert_integrations(session: AsyncSession, env: str, user: UserDTO):
    integration_service = get_integration_service(session=session)
    integration_configs = {
        "aws": AWSIntegrationConfig(
            aws_access_key_id=f"test_key_{env}",
            aws_secret_access_key=EncryptedSecretStr(f"test_secret_{env}"),
            aws_account=f"test_account_{env}",
            aws_assumed_role_name=f"test_assume_role{env}",
        ),
        "azurerm": AzureRMIntegrationConfig(
            client_id=f"test_client_id_{env}",
            client_secret=EncryptedSecretStr(f"test_client_secret_{env}"),
            tenant_id=f"test_tenant_{env}",
            subscription_id=f"test_subscription_{env}",
        ),
        "github": GithubIntegrationConfig(
            github_client_id=f"test_client_id_{env}",
            github_client_secret=EncryptedSecretStr(f"test_client_secret_{env}"),
        ),
        "bitbucket": BitbucketIntegrationConfig(
            bitbucket_user=f"test_user_{env}@example.com",
            bitbucket_key=EncryptedSecretStr(f"test_key_{env}"),
        ),
    }

    integration_types: dict[str, Literal["cloud", "git"]] = {
        "aws": "cloud",
        "azurerm": "cloud",
        "github": "git",
        "bitbucket": "git",
    }

    for provider, config in integration_configs.items():
        integration = IntegrationCreate(
            name=f"{provider}_{env}_account",
            description=get_sentence(),
            integration_type=integration_types[provider],
            integration_provider=cast(
                Literal["aws", "azurerm", "azure_devops", "github", "bitbucket", "mongodb_atlas", "datadog"],
                provider,
            ),
            configuration=config,
            labels=[provider, "integration", integration_types[provider]],
        )
        intg = await integration_service.get_all(
            filter={
                "integration_type": integration.integration_type,
                "name": integration.name,
                "integration_provider": integration.integration_provider,
            }
        )

        if intg:
            continue

        await integration_service.create(integration, user)
        await session.commit()


async def insert_storages(session: AsyncSession, env: str, user: UserDTO):
    storage_configs = {
        "aws": AWSStorageConfig(
            aws_bucket_name=f"test_bucket_{env}",
            aws_region=f"test_region_{env}",
            storage_provider="aws",
        ),
        "azurerm": AzureRMStorageConfig(
            azurerm_resource_group_name=f"test_group_{env}",
            azurerm_storage_account_name=f"test_account_{env}",
            azurerm_container_name=f"test_container_{env}",
            storage_provider="azurerm",
        ),
    }

    storage_service = get_storage_service(session=session)
    integration_service = get_integration_service(session=session)

    for provider, config in storage_configs.items():
        integration = await integration_service.get_all(
            filter={
                "integration_type": "cloud",
                "name": f"{provider}_{env}_account",
                "integration_provider": provider,
            }
        )

        assert len(integration) > 0, f"Integration not found for {provider} in {env}"

        storage = StorageCreate(
            name=f"{env}_{provider}_storage",
            description=get_sentence(),
            storage_type="tofu",
            storage_provider=cast(
                Literal["aws", "azurerm"],
                provider,
            ),
            integration_id=integration[0].id,
            configuration=config,
            labels=[provider, "storage", "tofu"],
        )
        created_storage = await storage_service.create(storage, user)
        await session.commit()
        await generate_logs(
            session=session, entity_name="storage", entity_id=str(created_storage.id), user_id=str(user.id)
        )

    await change_state(
        session=session,
        entity=Storage,
        state=ModelState.PROVISIONED,
        status=ModelStatus.DONE,
    )


async def insert_resources(session: AsyncSession, env: str, user: UserDTO):
    template_service = get_template_service(session=session)
    source_code_version_service = get_source_code_version_service(session=session)
    storage_service = get_storage_service(session=session)
    resource_crud = ResourceCRUD(session=session)

    resource_service = get_resource_service(session=session)

    query = select(Integration).where(
        Integration.integration_type == "cloud",
        Integration.name.ilike(f"%{env}%"),
    )
    result = await session.execute(query)
    integrations = result.scalars().all()

    templates = await template_service.get_all()
    source_code_versions = await source_code_version_service.get_all()

    for integration in integrations:
        previous_resource = None
        current_resource = None
        storage = await storage_service.get_all(filter={"integration_id": integration.id})

        for tpl in templates:
            scv = [sv for sv in source_code_versions if sv.template.id == tpl.id][0]
            source_code_version = await source_code_version_service.get_by_id_with_configs(str(scv.id))
            assert source_code_version is not None, "Source code version is none"

            name = generate_resource_name()
            variables = []
            for v in source_code_version.variable_configs:
                if v.type == "string":
                    variables.append(
                        Variables(
                            name=v.name,
                            value=f"test_{v.name}",
                            type=v.type,
                        )
                    )
                elif v.type == "boolean":
                    variables.append(
                        Variables(
                            name=v.name,
                            value=True,
                            type=v.type,
                        )
                    )
                elif v.type == "number":
                    variables.append(
                        Variables(
                            name=v.name,
                            value=10,
                            type=v.type,
                        )
                    )
                elif v.type == "object":
                    variables.append(
                        Variables(
                            name=v.name,
                            value={"key": "value"},
                            type=v.type,
                        )
                    )
                else:
                    variables.append(
                        Variables(
                            name=v.name,
                            value="test_value",
                            type=v.type,
                        )
                    )

            resource = ResourceCreate(
                template_id=tpl.id,
                source_code_version_id=source_code_version.id,
                name=name,
                description=get_sentence(),
                storage_id=storage[0].id if storage else None,
                storage_path=f"ik-catalog/{tpl.template}/{name}/terraform.tfstate",
                labels=[tpl.template, "resource", name],
                variables=variables,
                integration_ids=[integration.id],
                dependency_tags=[
                    DependencyTag(name=f"tag_{env}_{tpl.template}_key", value="value", inherited_by_children=True),
                    DependencyTag(name=f"tag_{env}_{tpl.template}_key2", value="value2"),
                ],
                dependency_config=[
                    DependencyConfig(name=f"{env}_{tpl.template}_key", value="value", inherited_by_children=True),
                    DependencyConfig(name=f"{env}_{tpl.template}_key2", value="value"),
                ],
            )
            if not previous_resource:
                current_resource = await resource_service.create(resource, user)
                await session.commit()
                previous_resource = current_resource
            else:
                assert previous_resource.id is not None, "Parent id is none"
                resource.parents = [previous_resource.id]
                current_resource = await resource_service.create(
                    resource,
                    user,
                    allowed_parent_states=[state.value for state in ModelState],
                )
                await session.commit()
                previous_resource = current_resource

            cur_res = await resource_crud.get_by_id(current_resource.id)
            assert cur_res is not None, "Resource is none"
            _ = await resource_crud.update(
                cur_res,
                {
                    "outputs": [
                        Outputs(
                            name=f"{o.name}",
                            value=f"value_{tpl.template}_{o.index}",
                        ).model_dump()
                        for o in source_code_version.output_configs
                    ],
                },
            )
            await session.commit()

            await generate_logs(
                session=session, entity_name="resource", entity_id=str(current_resource.id), user_id=str(user.id)
            )

    await change_state(
        session=session,
        entity=Resource,
        state=ModelState.PROVISIONED,
        status=ModelStatus.DONE,
    )


async def generate_logs(session: AsyncSession, entity_name: str, entity_id: str, user_id: str):
    async def insert_logs(log_controller: EntityLogger):
        for _ in range(100):
            lvl = random.choice(levels)
            if lvl == "info":
                log_controller.info(get_sentence())
            elif lvl == "error":
                log_controller.error(get_sentence())
            elif lvl == "warning":
                log_controller.warning(get_sentence())
        await log_controller.save_log()

    levels = ["info", "error", "warning"]

    audit_log_handler = AuditLogHandler(session=session, entity_name=entity_name)
    await audit_log_handler.create_log(
        entity_id=entity_id,
        requester_id=user_id,
        action="execute",
    )
    await session.commit()

    log_controller = EntityLogger(entity_name=entity_name, entity_id=entity_id, trace_id=audit_log_handler.trace_id)
    for i in range(1, 4):
        log_controller.execution_start = int(datetime.datetime.now().timestamp()) - i * 3000
        log_controller.add_log_header(f"User: {user_id} Action: Unknown")
        await insert_logs(log_controller)


async def create_fixtures():
    setup_service_environment()
    await drop_all_tables(engine)
    envs = ["dev", "staging", "prod"]
    async with get_session() as session:
        user = await create_user(session)
        await session.commit()
        await create_auth_provider(session, user)
        await insert_template(session, user)
        await session.commit()
        await insert_validation_rules(session)
        for env in envs:
            await insert_integrations(session, env, user)
            await insert_storages(session, env, user)

        await insert_source_code_and_version(session, user)
        for env in envs:
            await insert_resources(session, env, user)


if __name__ == "__main__":
    asyncio.run(create_fixtures())
