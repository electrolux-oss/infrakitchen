from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession

from application.source_code_versions.dependencies import get_source_code_version_service
from application.source_code_versions.schema import (
    SourceCodeVersionCreate,
    SourceConfigCreate,
    SourceConfigUpdateWithId,
    SourceOutputConfigCreate,
)
from application.source_codes.dependencies import get_source_code_service
from application.templates.dependencies import get_template_service

from application.source_code_versions.model import SourceCodeVersion
from core.constants import ModelStatus
from core.users.model import UserDTO

from fixtures.catalog import TEMPLATES_BY_KEY, TemplateFixture
from fixtures.utils import change_state


async def generate_configs_and_outputs(
    session: AsyncSession,
    source_code_version_instance: SourceCodeVersion,
    fixture: TemplateFixture,
):
    """Generate configs and outputs for the source code version"""
    source_code_version_service = get_source_code_version_service(session=session)

    configs = [
        SourceConfigCreate(
            index=idx,
            source_code_version_id=source_code_version_instance.id,
            name=v.name,
            description=v.description,
            type=v.type,
            required=v.required,
            default=v.default,
            sensitive=v.sensitive,
            frozen=v.frozen,
            restricted=v.restricted,
            unique=v.unique,
            options=v.options,
        )
        for idx, v in enumerate(fixture.variables)
    ]
    _ = await source_code_version_service.create_configs(configs)

    outputs = [
        SourceOutputConfigCreate(
            index=idx,
            source_code_version_id=source_code_version_instance.id,
            name=o.name,
            description=o.description,
        )
        for idx, o in enumerate(fixture.outputs)
    ]
    _ = await source_code_version_service.create_output_configs(outputs)


async def insert_source_code_version(session: AsyncSession, user: UserDTO):
    template_service = get_template_service(session=session)
    source_code_service = get_source_code_service(session=session)
    source_code_version_service = get_source_code_version_service(session=session)

    # insert version
    source_code_list = await source_code_service.get_all()
    source_code = source_code_list[0]
    folders_by_ref = {folder.ref: folder.folders for folder in source_code.git_folders_map}

    source_code_version_list = await source_code_version_service.get_all()

    templates = await template_service.get_all()
    templates_by_key = {t.template: t for t in templates}

    for template in templates:
        if template.id in [version.template.id for version in source_code_version_list]:
            continue

        fixture = TEMPLATES_BY_KEY.get(template.template)
        if not fixture or fixture.folder is None or fixture.version is None:
            continue

        if fixture.folder not in folders_by_ref.get(fixture.version, []):
            raise Exception(
                f"No folder {fixture.folder} found for template {template.template} "
                f"at tag {fixture.version} in source code {source_code.source_code_url}"
            )

        version = SourceCodeVersionCreate(
            template_id=template.id,
            source_code_id=source_code.id,
            source_code_version=fixture.version,
            source_code_folder=fixture.folder,
            description=get_sentence(),
        )
        current_code_version = await source_code_version_service.create_source_code_version(version, user)
        await session.commit()
        scv_from_db = await source_code_version_service.crud.get_by_id(current_code_version.id)
        assert scv_from_db is not None
        scv_from_db.variables = [v.to_dict() for v in fixture.variables]
        scv_from_db.outputs = [o.to_dict() for o in fixture.outputs]
        await generate_configs_and_outputs(session=session, source_code_version_instance=scv_from_db, fixture=fixture)
        await session.commit()

        # Link inputs to outputs of templates up the tree, used as their defaults
        if fixture.references:
            references = {r.variable: r for r in fixture.references}
            configs = await source_code_version_service.get_configs_by_scv_id(current_code_version.id)
            config_updates: list[SourceConfigUpdateWithId] = []

            for config in configs:
                reference = references.get(config.name)
                if not reference:
                    continue
                reference_template = templates_by_key.get(reference.template)
                if not reference_template:
                    raise ValueError(
                        f"Reference template '{reference.template}' not found for "
                        f"config '{config.name}' in template '{template.template}'"
                    )
                config_updates.append(
                    SourceConfigUpdateWithId(
                        id=config.id,
                        reference_template_id=reference_template.id,
                        output_config_name=reference.output,
                        template_id=template.id,
                    )
                )

            if config_updates:
                await source_code_version_service.update_configs(current_code_version.id, config_updates)
                await session.commit()

    await change_state(
        session=session,
        entity=SourceCodeVersion,
        status=ModelStatus.DONE,
    )
