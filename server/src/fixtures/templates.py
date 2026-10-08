from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession

from application.templates.dependencies import get_template_service
from application.templates.schema import TemplateConfig, TemplateCreate
from core.users.model import UserDTO
from fixtures.catalog import TEMPLATES


async def insert_templates(session: AsyncSession, user: UserDTO):
    template_service = get_template_service(session=session)
    templates_by_key = {}

    # The catalog lists parents before their children
    for fixture in TEMPLATES:
        existant_template = await template_service.get_all(filter={"name": fixture.name})
        if existant_template:
            templates_by_key[fixture.key] = existant_template[0]
            continue

        parent_ids = []
        for parent_key in fixture.parents:
            parent_template = templates_by_key.get(parent_key)
            if parent_template is None:
                existing_parent = await template_service.get_all(filter={"template": parent_key})
                if not existing_parent:
                    raise ValueError(f"Parent template '{parent_key}' not found for template '{fixture.key}'")
                parent_template = existing_parent[0]
                templates_by_key[parent_key] = parent_template

            assert parent_template.id is not None
            parent_ids.append(parent_template.id)

        template_body = TemplateCreate(
            name=fixture.name,
            description=get_sentence(),
            template=fixture.key,
            abstract=fixture.abstract,
            labels=fixture.labels,
            configuration=TemplateConfig(
                naming_convention=fixture.naming_convention,
                required_configuration_variables=fixture.required_configuration_variables,
            ),
            parents=parent_ids,
        )
        current_template = await template_service.create_template(template_body, user)
        await session.commit()
        templates_by_key[fixture.key] = current_template

    await session.commit()
