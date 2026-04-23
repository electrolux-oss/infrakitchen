from lorem import get_sentence
from sqlalchemy.ext.asyncio import AsyncSession

from application.templates.dependencies import get_template_service
from application.templates.schema import TemplateConfig, TemplateCreate
from core.users.model import UserDTO


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
            configuration=TemplateConfig(),
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

    await session.commit()
